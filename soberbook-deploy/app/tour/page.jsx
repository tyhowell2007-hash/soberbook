import Link from 'next/link';
import Player from './Player';

/* =====================================================================
   THE WALKTHROUGH — soberbook.app/tour

   🔴 THIS PAGE IS PUBLIC ON PURPOSE, AND THAT IS THE WHOLE DESIGN CALL.

   It is linked from an email to 146 members. A member taps that link on
   their phone, hours or days later, quite possibly signed out. If this
   page sat behind the login they would meet a password box instead of
   the film — which is character for character the bug that made people
   try Sober Book in August, hit /login, and tell Ty "it's the old
   version" before leaving.

   Aug 19 fixed that at the front door. Aug 23 found the same wall had
   simply moved back one screen. This is the third time; the lesson is
   that ANY page a link in the outside world points at must open for a
   signed-out stranger.

   ⚠️ And there is nothing here to protect. Every screen in the film is
   rebuilt from Sober Book's own stylesheets with invented handles and
   invented posts — the rule set before a frame was rendered. No real
   member appears in it, so a members-only gate would buy exactly zero
   privacy at the cost of the people it was meant to serve.

   ⚠️ '/tour' is in the middleware's `open` list and '.mp4' is excluded
   from its matcher. BOTH are required: without the first the page
   redirects, without the second the video file itself redirects and the
   player shows a black rectangle with no error anywhere.
   ===================================================================== */
export const metadata = {
  title: 'A walkthrough of Sober Book',
  description:
    'Fourteen minutes, start to finish — what Sober Book does and how to use it.',
};

export default function TourPage() {
  return (
    <div className="tourpage">
      <div className="tmast">
        <span className="tlg">🌱 SOBER BOOK</span>
      </div>

      <div className="tpad">
        <h1 className="th">Everything you can do in Sober Book</h1>
        <p className="tsub">Fourteen minutes. Start to finish.</p>

        <Player />

        {/* ⚠️ BOTH doors, and the new one first — the Aug 29 landing-page
            lesson. A stranger doesn't know they're allowed in; a member
            knows they have an account and will go looking. Guessing which
            one somebody is, and showing only that, is what bounced
            everybody in the first place. */}
        <div className="tgo">
          <Link href="/login" className="tbtn">Go in ›</Link>
          <p className="tfine">
            Already a member? <Link href="/login">Sign in</Link>
          </p>
        </div>

        {/* No claim here that isn't true today. Notably absent: any
            number of members (it moves), and anything about verification
            (nobody is verified — that claim was cut from the whole app on
            Aug 15 and must never come back). */}
        <p className="tfoot">
          No ads. Nobody sells your info. It&apos;s free.
        </p>
      </div>
    </div>
  );
}
