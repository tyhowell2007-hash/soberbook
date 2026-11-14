import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';
import { sendMail } from '../../../lib/mail';
import { deliverPush } from '../../../lib/deliver-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   "TAKE DOWN AN IMAGE OF ME" — 0204, 13 Nov 2026.
   The notice-and-removal request the TAKE IT DOWN Act has required of
   every app with user posts since 19 May 2026: anyone (signed out too)
   can ask us to remove a private or sexual image of them, and we act
   within 48 hours. A valid request needs: where it is, a statement that
   it isn't consensual, a signature, and contact details.

   If the request names a post (/p/<id>), we file a private-image report on
   it straight away, which hides the picture at once (hold_on_image_report)
   and alerts Ty and Kenny. Either way, both get a push and an email.
   ⚠️ OPEN IN middleware.js. Honeypot + limits protect it.
   ===================================================================== */
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Not available right now.' }, { status: 500 });
  const admin = adminClient();
  let b; try { b = await req.json(); } catch { b = {}; }
  if (clip(b.website, 200)) return NextResponse.json({ ok: true });   // honeypot

  const where = clip(b.where, 1000);
  const signature = clip(b.signature, 120);
  const email = clip(b.email, 200).toLowerCase();
  if (where.length < 3) return NextResponse.json({ error: 'Tell us where the image is.' }, { status: 400 });
  if (b.isPerson !== true || b.noConsent !== true) return NextResponse.json({ error: 'Please tick both boxes.' }, { status: 400 });
  if (signature.length < 2) return NextResponse.json({ error: 'Type your full name as your signature.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: 'Add an email so we can tell you when it’s done.' }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ipHash = ip ? createHash('sha256').update('sb-takedown:' + ip).digest('hex').slice(0, 32) : null;
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const { count } = await admin.from('takedown_requests').select('id', { count: 'exact', head: true })
    .or(`email.eq.${email}${ipHash ? `,ip_hash.eq.${ipHash}` : ''}`).gte('created_at', dayAgo);
  if ((count || 0) >= 10) return NextResponse.json({ error: 'We have your requests from today. You can also write to hello@soberbook.app.' }, { status: 429 });

  const m = where.match(/\/p\/([0-9a-f-]{36})/i);
  let postId = null;
  if (m) {
    const { data: p } = await admin.from('posts').select('id').eq('id', m[1]).maybeSingle();
    postId = p?.id || null;
  }

  const { data: t, error } = await admin.from('takedown_requests').insert({
    where_text: where, post_id: postId, signature, email, is_person: true, no_consent: true, ip_hash: ipHash,
  }).select('id, num').single();
  if (error || !t) return NextResponse.json({ error: 'Couldn’t send that. Write to hello@soberbook.app.' }, { status: 500 });

  if (postId) {
    const { data: r } = await admin.from('reports').insert({
      reporter_id: null, target_type: 'post', target_id: postId, kind: 'ncii',
      reason: `Take-down request TD-${String(t.num).padStart(4, '0')} from the Support page`, status: 'open',
    }).select('id').single();
    if (r?.id) await admin.from('takedown_requests').update({ report_id: r.id }).eq('id', t.id);
  }

  try {
    const { data: mods } = await admin.from('profiles').select('id').eq('is_admin', true);
    const ids = (mods || []).map((x) => x.id);
    if (ids.length) {
      const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, failures').in('user_id', ids);
      if (subs?.length) await deliverPush(admin, subs, '/admin/urgent');
      for (const id of ids) {
        const { data } = await admin.auth.admin.getUserById(id);
        if (!data?.user?.email) continue;
        await sendMail({
          to: data.user.email,
          subject: 'Take-down request on Sober Book (48-hour clock)',
          text: 'Someone asked us to remove a private image of them. The TAKE IT DOWN Act gives us 48 hours.\n\nOpen the queue: https://soberbook.app/admin',
          html: '<p><strong>Someone asked us to remove a private image of them.</strong> The TAKE IT DOWN Act gives us 48 hours.</p><p><a href="https://soberbook.app/admin">Open the queue</a></p>',
        });
      }
    }
  } catch { /* the request is saved; the queue still shows it */ }

  try {
    await sendMail({
      to: email,
      subject: 'We got your request',
      text: 'We received your request to remove an image. We act within 48 hours and will email you when it’s done.\n\n— Sober Book\nhello@soberbook.app',
      html: '<p>We received your request to remove an image. We act within 48 hours and will email you when it’s done.</p><p>— Sober Book<br>hello@soberbook.app</p>',
    });
  } catch { /* fine */ }

  return NextResponse.json({ ok: true });
}
