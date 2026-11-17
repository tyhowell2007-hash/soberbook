import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';

/* =====================================================================
   ⭐ WHERE THE RESET EMAIL'S BUTTON GOES — 17 Nov 2026.
   Ty: "This needs to be a simple fix that they do everything all in one
   go and they're back in."

   🔴 THE PROBLEM IT ENDS. A reset link used to carry a one-time code that
   only the browser which ASKED for the reset could cash in. Ask inside
   the iPhone/Android app, open the email in Gmail or Safari, and the
   code was useless — "that link's gone stale", every time. Ty's mom hit
   it five times in a row on 17 Nov.

   The Supabase reset-password email template now points here:
     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset
   and THIS SERVER cashes the token in (verifyOtp), sets the sign-in
   cookies on whatever browser opened the link, and sends them to /reset
   already signed in. It does not matter which browser, phone or app
   asked for the email, or whether that app was running an old copy.

   ⚠️ The token is single-use and expires (about an hour). A spent or old
   one lands on /reset's "that link's gone stale" screen, which offers a
   fresh one. /auth is already open in middleware.js.
   ===================================================================== */
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') || 'recovery';
  const nextRaw = url.searchParams.get('next') || '/reset';
  // Only ever send people to a page on this site.
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/reset';

  if (token_hash && ['recovery', 'email', 'signup', 'magiclink', 'invite', 'email_change'].includes(type)) {
    const supabase = serverClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    // Same shape as Supabase's own Next.js guide: cookies() set the
    // session, redirect() carries them on the response.
    if (!error) redirect(next);
  }
  redirect('/reset#error=link_expired');
}
