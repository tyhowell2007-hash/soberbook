import { NextResponse } from 'next/server';
import { serverClient } from '../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* 0203 — see components/AccountMark.jsx. Signed-in only. The plain device
   id and connection address go straight into record_account_mark(), which
   scrambles them before anything is stored; this route keeps nothing. */
export async function POST(req) {
  const { data: { user } } = await serverClient().auth.getUser();
  if (!user || !adminConfigured()) return NextResponse.json({ ok: false }, { status: 401 });
  let d = '';
  try { d = String((await req.json())?.d || '').slice(0, 100); } catch { /* no device code */ }
  const net = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64);
  const { error } = await adminClient().rpc('record_account_mark', { p_user: user.id, p_device: d, p_net: net });
  return NextResponse.json({ ok: !error });
}
