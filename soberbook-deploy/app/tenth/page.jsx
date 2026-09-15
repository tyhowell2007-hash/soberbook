import Link from 'next/link';
import TenthStep from '../components/TenthStep';

/* =====================================================================
   YOUR 10TH STEP.  15 Sept.

   Ty asked for a "10-step inventory" and, shown the fork, chose to name
   the step plainly on screen rather than use a neutral word. The cost he
   was shown and accepted: the meetings banner has said "all paths
   welcome - Suboxone included" since August, and a step number tells a
   member who is not in a 12-step program that this room is not theirs.
   Recorded so nobody re-opens it thinking it was never noticed. This is
   the same shape as the shrine icon on the Quiet tab - his call, made
   after hearing the argument against.

   🔴 COPYRIGHT. The Twelve Steps and the Big Book's inventory questions
   are (c) AA World Services. Naming the step is a factual reference and
   is fine; reproducing their wording is not, and this project already
   said no to Just For Today ((c) NA World Services) on the readings page.
   Every question in TenthStep.jsx is written from scratch. Do not
   "improve" one by reaching for the original phrasing.

   ⚠️ THE EVENING REVIEW ON THE PLEDGE CARD WAS NOT TOUCHED. Ty's call
   off three options: "How was today?" stays exactly as it is - 47 people
   have used it - and becomes the doorway into this page, one tap deeper.
   The 3 Sept inbox lesson is why: people navigate a familiar surface by
   SHAPE AND POSITION, and replacing something 47 people already use is
   not a neutral improvement.

   ⚠️ NO redirect and no session check of its own. The middleware already
   sends an unauthenticated request to /login, and a second gate here
   would be a second implementation of the same rule.
   ===================================================================== */

export const metadata = {
  title: 'Your 10th step · Sober Book',
  /* Behind the login wall already, and noindex on top. This is the most
     private page in the app; it must never appear in a search result
     beside anybody's name. */
  robots: { index: false, follow: false },
};

export default function TenthPage() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to Home">&lsaquo;</Link>
        <span className="lg">Your 10th step</span>
      </div>
      <div className="pad">
        <TenthStep />
      </div>
    </>
  );
}
