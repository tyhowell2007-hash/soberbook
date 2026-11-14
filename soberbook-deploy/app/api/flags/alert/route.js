import { NextResponse } from 'next/server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';
import { deliverPush } from '../../../../lib/deliver-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   0203 — "A NEW ACCOUNT NEEDS A LOOK."
   The database calls this (raise_account_flag → pg_net) when a serious
   flag is raised: a banned person back, a bot burst, or spam. It buzzes
   Ty and Kenny. Same shared secret and same 404 as /api/report/triage.
   ⚠️ The lock screen words are constants chosen by the path
   ('/admin/accounts', lib/push-words.js + public/sw.js): never a handle.
   ===================================================================== */
export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  const admin = adminClient();
  const { data: cfg } = await admin.from('push_config').select('secret').eq('id', 1).maybeSingle();
  if (!cfg?.secret || (req.headers.get('x-push-secret') || '') !== cfg.secret) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const { data: mods } = await admin.from('profiles').select('id').eq('is_admin', true);
  const ids = (mods || []).map((m) => m.id);
  if (!ids.length) return NextResponse.json({ ok: true, delivered: 0 });
  const { data: subs } = await admin.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failures').in('user_id', ids);
  if (!subs?.length) return NextResponse.json({ ok: true, delivered: 0 });
  const { ok } = await deliverPush(admin, subs, '/admin/accounts');
  return NextResponse.json({ ok: true, delivered: ok });
}
