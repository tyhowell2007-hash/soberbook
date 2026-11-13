import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';
import { sendMail } from '../../../../lib/mail';
import { ticketNo } from '../../../../lib/tickets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   THE TICKET BOARD'S BUTTONS — 0202, 13 Nov 2026.
   take · reply · fixed · notbug · reopen. Ty and Kenny only.

   ⚠️ 404 for anyone else, same as /admin: an outsider learns nothing.
   Fixing a ticket fixes every ticket grouped with it (same problem, same
   screen, within 6 hours), and every one of those people hears back.
   A member hears through the bell; a signed-out person by email.
   ===================================================================== */

const MEMBER_LINE = {
  fixed: 'Fixed. Thank you for telling us!',
  notbug: 'We looked into this and it’s working the way it’s meant to. Thanks for checking with us.',
};

async function tell(admin, t, words) {
  if (t.user_id) {
    await admin.from('notifications').insert({ user_id: t.user_id, kind: 'ticket', actor_anon: true });
  } else if (t.contact_email) {
    await sendMail({
      to: t.contact_email,
      subject: `Your Sober Book ticket ${ticketNo(t.num)}`,
      text: `${words}\n\n— Sober Book\nhello@soberbook.app`,
      html: `<p>${words.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p><p>— Sober Book<br>hello@soberbook.app</p>`,
    });
  }
}

export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const admin = adminClient();
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  let b; try { b = await req.json(); } catch { b = {}; }
  const { id, action } = b || {};
  const text = typeof b?.body === 'string' ? b.body.trim().slice(0, 2000) : '';
  const { data: t } = await admin.from('tickets').select('*').eq('id', id).maybeSingle();
  if (!t) return NextResponse.json({ error: 'That ticket is gone.' }, { status: 404 });
  const now = new Date().toISOString();

  if (action === 'take') {
    await admin.from('tickets').update({ owner_id: user.id, status: t.status === 'new' ? 'working' : t.status, updated_at: now }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'reply') {
    if (!text) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
    await admin.from('ticket_replies').insert({ ticket_id: id, author_id: user.id, body: text });
    await admin.from('tickets').update({
      status: t.status === 'new' ? 'working' : t.status,
      owner_id: t.owner_id || user.id, updated_at: now }).eq('id', id);
    await tell(admin, t, text);
    return NextResponse.json({ ok: true });
  }

  if (action === 'fixed' || action === 'notbug') {
    /* The same problem from other people: same category and screen,
       within 6 hours either side, still open. Only for "fixed" — "not a
       bug" is a judgement about one person's report. */
    let group = [t];
    if (action === 'fixed') {
      const lo = new Date(new Date(t.created_at).getTime() - 6 * 36e5).toISOString();
      const hi = new Date(new Date(t.created_at).getTime() + 6 * 36e5).toISOString();
      let q = admin.from('tickets').select('*').eq('category', t.category)
        .in('status', ['new', 'working']).gte('created_at', lo).lte('created_at', hi);
      q = t.screen ? q.eq('screen', t.screen) : q.is('screen', null);
      const { data } = await q;
      group = [t, ...(data || []).filter((x) => x.id !== t.id)];
    }
    const words = text || MEMBER_LINE[action];
    for (const g of group) {
      await admin.from('tickets').update({
        status: action, updated_at: now, fixed_at: action === 'fixed' ? now : null,
        owner_id: g.owner_id || user.id }).eq('id', g.id);
      await admin.from('ticket_replies').insert({ ticket_id: g.id, author_id: user.id, body: words });
      await tell(admin, g, words);
    }
    return NextResponse.json({ ok: true, closed: group.length });
  }

  if (action === 'reopen') {
    await admin.from('tickets').update({ status: 'working', fixed_at: null, updated_at: now }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
