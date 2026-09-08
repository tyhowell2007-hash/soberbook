import Link from 'next/link';
import Ask from './Ask';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Help — Sober Book',
  description: 'How Sober Book works, and where to find a person.',
};

/* =====================================================================
   /resources — HOW THE APP WORKS.

   ⚠️ NOT /help. That address was already taken, and by the crisis page —
   "If you need somebody now", 988, the outside lines. Putting a question
   box in front of that would have buried the one page that has to be
   reachable in a hurry behind a robot. Different job, different door.

   ! There is no auth check in this file and that is not an oversight:
   middleware.js redirects every unauthenticated request to /login, so a
   check here would be a second copy of a rule that already exists —
   and the second copy is the one that drifts (0046 -> 0049).
   ===================================================================== */

export default function Resources() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">help</span>
      </div>
      <div className="bar">Nothing you ask here is saved</div>

      <div className="pad">
        <Ask />
      </div>
    </>
  );
}
