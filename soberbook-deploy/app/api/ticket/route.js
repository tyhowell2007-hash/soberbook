import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { serverClient } from '../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';
import { sendMail } from '../../../lib/mail';
import { deliverPush } from '../../../lib/deliver-push';
import { CATS, catLabel } from '../../../lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   FILE A PROBLEM TICKET — 0202, 13 Nov 2026.
   Prototype approved by Ty: claude.ai/artifact/JkJUka5NYunDLFs16QEG59

   One route for both doors:
     · signed in  — /report, and the "Report this problem" link in errors
     · signed out — the form on /support, for somebody locked out. They
       give an email, because there is no account to answer.

   ⚠️ OPEN IN middleware.js, because the second door has no session.
   It protects itself: a honeypot field, and limits (10 a day for a
   member; 3 a day per email and 5 a day per connection signed out).

   🔴 Then it buzzes Ty and Kenny. The lock screen says a ticket came in
   and never what it says (lib/push-words.js, '/admin/tickets').
   Signing in, Messages and every signed-out ticket also email them both,
   because those are people who can't use the app at all (Ty, 13 Nov).
   ===================================================================== */

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function adminIds(admin) {
  const { data } = await admin.from('profiles').select('id').eq('is_admin', true);
  return (data || []).map((m) => m.id);
}

async function buzz(admin, ids) {
  if (!ids.length) return 0;
  const { data: subs } = await admin.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failures').in('user_id', ids);
  if (!subs?.length) return 0;
  const { ok } = await deliverPush(admin, subs, '/admin/tickets');
  return ok;
}

async function mail(admin, ids, t) {
  let sent = 0;
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id);
    const to = data?.user?.email;
    if (!to) continue;
    const label = catLabel(t.category);
    const res = await sendMail({
      to,
      subject: `Problem ticket SB-${String(t.num).padStart(4, '0')} · ${label}`,
      text: `A ${label} problem ticket just came in${t.user_id ? '' : ' from someone who is signed out'}.\n\n`
          + 'Open the board: https://soberbook.app/admin/tickets',
      html: `<p><strong>A ${label} problem ticket just came in</strong>${t.user_id ? '' : ' from someone who is signed out'}.</p>`
          + '<p><a href="https://soberbook.app/admin/tickets">Open the board</a></p>',
    });
    if (res?.ok) sent++;
  }
  return sent;
}

export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Not available right now.' }, { status: 500 });
  const admin = adminClient();

  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Couldn’t read that.' }, { status: 400 }); }

  /* Honeypot: a field people never see. A bot that fills it gets a
     cheerful "sent" and nothing is stored. */
  if (clip(form.get('website'), 200)) return NextResponse.json({ ok: true, num: 0 });

  const category = clip(form.get('category'), 20);
  const description = clip(form.get('description'), 2000);
  if (!CATS.some((c) => c.id === category)) return NextResponse.json({ error: 'Pick what’s going wrong.' }, { status: 400 });
  if (description.length < 3) return NextResponse.json({ error: 'Tell us a little about what happened.' }, { status: 400 });

  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();

  const row = {
    category, description,
    screen: clip(form.get('screen'), 120) || null,
    device: clip(form.get('device'), 300) || null,
    error_text: clip(form.get('error'), 300) || null,
  };
  const dayAgo = new Date(Date.now() - 864e5).toISOString();

  if (user) {
    row.user_id = user.id;
    const { count } = await admin.from('tickets').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', dayAgo);
    if ((count || 0) >= 10) return NextResponse.json({ error: 'That’s a lot of tickets today. We have them all, and we’re on it.' }, { status: 429 });
  } else {
    const email = clip(form.get('email'), 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: 'Add an email so we can answer you.' }, { status: 400 });
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    row.contact_email = email;
    row.ip_hash = ip ? createHash('sha256').update('sb-ticket:' + ip).digest('hex').slice(0, 32) : null;
    const { count: byEmail } = await admin.from('tickets').select('id', { count: 'exact', head: true })
      .eq('contact_email', email).gte('created_at', dayAgo);
    const { count: byIp } = row.ip_hash
      ? await admin.from('tickets').select('id', { count: 'exact', head: true }).eq('ip_hash', row.ip_hash).gte('created_at', dayAgo)
      : { count: 0 };
    if ((byEmail || 0) >= 3 || (byIp || 0) >= 5) {
      return NextResponse.json({ error: 'We already have your tickets from today. You can also write to hello@soberbook.app.' }, { status: 429 });
    }
  }

  /* The screenshot: re-drawn by sharp as a plain JPEG, which drops every
     hidden detail a photo can carry (location, camera, time). */
  const shot = form.get('shot');
  if (shot && typeof shot === 'object' && shot.size > 0) {
    if (shot.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'That picture is too big. Try a screenshot instead.' }, { status: 400 });
    try {
      const sharp = (await import('sharp')).default;
      const buf = await sharp(Buffer.from(await shot.arrayBuffer()))
        .rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 }).toBuffer();
      const path = `${user ? user.id : 'signed-out'}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await admin.storage.from('ticket-shots')
        .upload(path, buf, { contentType: 'image/jpeg' });
      if (!upErr) row.shot_path = path;
    } catch {
      return NextResponse.json({ error: 'That file isn’t a picture we can read. Try a screenshot.' }, { status: 400 });
    }
  }

  const { data: t, error } = await admin.from('tickets').insert(row)
    .select('id, num, category, user_id').single();
  if (error || !t) return NextResponse.json({ error: 'Couldn’t send that. Try again, or write to hello@soberbook.app.' }, { status: 500 });

  /* 🔴 The ticket is saved before any alert is tried, and an alert that
     fails never fails the ticket. */
  try {
    const ids = await adminIds(admin);
    await buzz(admin, ids);
    if (!t.user_id || t.category === 'signin' || t.category === 'messages') await mail(admin, ids, t);
  } catch { /* the board still has it */ }

  return NextResponse.json({ ok: true, num: t.num });
}
