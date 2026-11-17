import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* =====================================================================
   ⭐ FORGOT PASSWORD — 17 Nov 2026. Ty: "We need to make this process
   extremely easy for the user."

   🔴 WHY THIS ROUTE EXISTS. The browser client signs in with PKCE, and a
   PKCE reset link only works in the SAME browser that asked for it (the
   matching key lives in that browser's storage). Ask for a reset inside
   the iPhone or Android app, open the email, and the link lands in
   Gmail's or Safari's browser instead — no key, so /reset said "that
   link's gone stale" and sent them back to sign in. Ty's mom hit exactly
   this on 17 Nov: the link was spent, the password never changed.

   Asking from the server with the IMPLICIT flow puts the session in the
   link itself (#access_token=…), so it works in whatever browser opens
   it. /reset picks the tokens out of the address.

   🔴 THIS MUST NEVER CONFIRM WHO IS A MEMBER. It answers { ok: true }
   whether or not the address has an account, and the login page says
   the same sentence either way. Supabase's own per-address limit still
   applies; a rate-limit answer is passed back as "wait a minute".
   ===================================================================== */
export async function POST(request) {
  let email = '';
  try { email = String((await request.json())?.email || '').trim().toLowerCase(); } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'bad_email' }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset` });
  if (error && (error.status === 429 || /rate|seconds/i.test(error.message || ''))) {
    return NextResponse.json({ ok: false, error: 'slow_down' }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}
