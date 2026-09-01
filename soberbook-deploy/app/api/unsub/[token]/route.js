import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   TURNING EMAIL OFF, WITHOUT AN ACCOUNT.  31 Aug.

   🔴 POST ONLY, AND THAT IS THE WHOLE POINT OF THIS FILE EXISTING.

   The obvious build is a link that unsubscribes you when you click it.
   It is wrong, and the failure is invisible: corporate mail gateways,
   antivirus scanners and link-preview fetchers all follow URLs inside
   incoming email to check them for malware. Every one of those is a GET.
   Ship the obvious version and members get unsubscribed by a security
   robot that read their mail before they did — and the symptom is
   "notifications just stopped working for some people", which nobody
   ever reports and nobody could diagnose.

   ⭐ A GET must never change anything. So:
     - this endpoint answers POST and nothing else, and it is what the
       List-Unsubscribe header points at, because Gmail's and Outlook's
       own one-click unsubscribe button sends a POST (RFC 8058);
     - the link a human sees goes to /unsub/<token>, a page that shows a
       button. Reading the page changes nothing; pressing the button
       posts here.

   ⚠️ No auth, on purpose. The person clicking is by definition not
   signed in — that is the entire reason this exists. The token is the
   credential, it is unguessable, and email_optout() can only ever set
   the flag to false. There is no token that turns email ON.
   ===================================================================== */

async function optOut(token) {
  /* ⚠️ The ANON key, not the service role. This needs exactly one
     capability — call email_optout — and anon has been granted exactly
     that (0101). Reaching for the admin client here would hand a route
     with no authentication the keys to the whole database. */
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { error } = await supabase.rpc('email_optout', { p_token: token });
  return !error;
}

export async function POST(_req, { params }) {
  const token = params?.token || '';

  /* ⚠️ Shape-check before it reaches Postgres. A non-uuid raises 22P02
     and the error text quotes the input back — an error message is an
     output channel, which this codebase learned on 6 Aug when a
     constraint violation was quoting author_id at strangers. */
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  if (isUuid) await optOut(token);

  /* 🔴 THE SAME ANSWER EITHER WAY. A real token and a made-up one get an
     identical 200. Anything else turns this into an oracle: fire tokens
     at it, watch which ones answer differently, and you have a way to
     enumerate members. It also means a scanner learns nothing. */
  return NextResponse.json({ ok: true });
}

/* A GET here is almost certainly a scanner or somebody pasting the URL.
   It changes nothing and says nothing useful. */
export async function GET() {
  return NextResponse.json({ ok: true, note: 'nothing happens on a GET' });
}
