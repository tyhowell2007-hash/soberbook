import { notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import Send from './Send';

export const dynamic = 'force-dynamic';

/* =====================================================================
   SENDING A BROADCAST.

   ⭐ WHY THIS PAGE EXISTS RATHER THAN A SCRIPT I RUN. The Resend key
   lives in Vercel's environment. Sending from outside the app means
   putting that key somewhere it can be read — a chat window, a shell
   history, a file. A button inside the app uses the key without anybody
   seeing it, and Ty's own login is the authorisation.

   ⚠️ 404, not "not allowed" — the /admin convention. A polite refusal
   confirms the route is real and worth attacking.

   ⚠️ This check is a convenience over a locked door, not the lock. The
   route behind it does its own owner check, and the database functions
   it calls are revoked from `authenticated` entirely. Delete this file
   and nobody can still send anything.

   🔴🔴 2 SEPT — THIS PAGE SPENT A DAY DESCRIBING THE WRONG EMAIL, AND
   IT IS THE EXACT FAILURE `lib/broadcasts.js` WAS WRITTEN TO PREVENT.
   `Send.jsx` carried `campaign = 'survey'` as a DEFAULT PARAMETER and
   this page rendered a bare `<Send />`. So the buttons operated on the
   survey while every word above them — the heading, the /tour link, and
   a warning about "the only email like this you'll get" — described the
   walkthrough. The counters were honest (0 sent, because the survey had
   sent nobody) and read as alarming under a headline about a campaign
   that had already gone to 151 people.

   ⭐ THE RULE, and the registry already says it in different words: a
   DEFAULT is how the label and the behaviour drift apart. The campaign
   is now NAMED here, on the same screen as the words describing it, so
   changing one without the other is a visible edit rather than an
   invisible one. Send.jsx no longer has a default to fall back on.
   ===================================================================== */

/* ⚠️ Named once, used by both the copy and the component. Adding the
   next broadcast means changing this line and the paragraph under it
   TOGETHER — which is the point. */
const CAMPAIGN = 'survey';

export default async function SendPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  return (
    <div className="pad">
      <h1>The survey email</h1>
      <p className="hint">
        One email, to everybody who has email switched on, linking to{' '}
        <Link href="/survey">soberbook.app/survey</Link>. Nobody can get it twice.
      </p>
      <Send campaign={CAMPAIGN} />

      {/* ⚠️ Written on the page, not just in a commit message, because
          this is the thing that will be forgotten in six weeks. */}
      <p className="hint">
        The walkthrough email on 1 Sept said out loud it was <b>the only one
        like it</b> anybody would get. This one acknowledges that once and
        promises to stop. <b>That makes it the last broadcast down this pipe.</b>{' '}
        A third makes both sentences a lie, and this app does not make claims
        it can&apos;t keep.
      </p>
    </div>
  );
}
