import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';
import { sendMail } from '../../../../lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* 0204 — closing a take-down request: 'removed' or 'not_match'. Ty and
   Kenny only (404 otherwise). The person who asked is emailed either way. */
export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  const { data: { user } } = await serverClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const admin = adminClient();
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  let b; try { b = await req.json(); } catch { b = {}; }
  if (!['removed', 'not_match'].includes(b.status)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const { data: t } = await admin.from('takedown_requests').update({
    status: b.status, decided_at: new Date().toISOString(), decided_by: user.id,
  }).eq('id', b.id).eq('status', 'new').select('email, num').maybeSingle();
  if (!t) return NextResponse.json({ error: 'Already handled.' }, { status: 409 });

  const words = b.status === 'removed'
    ? 'The image you asked about has been removed from Sober Book.'
    : 'We looked into your request and couldn’t find an image matching it on Sober Book. If you can send a link or more detail, reply to hello@soberbook.app and we’ll look again right away.';
  await sendMail({
    to: t.email, subject: `Your request TD-${String(t.num).padStart(4, '0')}`,
    text: `${words}\n\n— Sober Book\nhello@soberbook.app`,
    html: `<p>${words}</p><p>— Sober Book<br>hello@soberbook.app</p>`,
  });
  return NextResponse.json({ ok: true });
}
