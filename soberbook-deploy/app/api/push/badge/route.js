import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';
import { sendApnsBadge } from '../../../../lib/apns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   CLEAR THE RED BUBBLE ON THE APP ICON.  16 Nov 2026.

   The iPhone app calls this when it opens or comes back to the front
   (components/NativePush.jsx). It sends a badge-only push — no words, no
   sound, nothing on the lock screen — that sets the icon back to 0.

   🔴 Only ever the CALLER's own phones. The member is taken from their
   own session, never from the request body, so nobody can touch anyone
   else's icon. Signed out → 401, nothing sent.

   Why a push and not the app itself: the app shows soberbook.app, so
   this ships with the website — no new TestFlight build needed.
   ===================================================================== */
export async function POST() {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 });

  const { data: { user } } = await serverClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const admin = adminClient();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)
    .like('endpoint', 'apns:%');

  const tokens = (subs || []).map((s) => String(s.endpoint).slice(5));
  if (!tokens.length) return NextResponse.json({ ok: true, devices: 0 });

  const res = await sendApnsBadge(tokens, 0);
  return NextResponse.json({ ok: true, devices: tokens.length, cleared: res.filter((r) => r.ok).length });
}
