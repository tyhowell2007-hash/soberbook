import Link from 'next/link';
import GratitudeRoom from './Room';

/* =====================================================================
   ONE GOOD THING, GIVEN A DOOR.  15 Sept.

   A member asked for a gratitude list. Ty: "make it as simple as
   possible, make it its own thing, and people have to do it every day" -
   and, separately, "we want to keep the check-in pledge, but also add
   gratitude." So this is a room of its own, not a fourth question bolted
   onto the check-in.

   ⭐ THE CARD STAYS ON HOME. Same rule as the pledge on 7 Sept, and it is
   learned the hard way: on 3 Sept Ty's inbox was reorganised without
   warning and he thought chat was broken, because people navigate a
   familiar surface by SHAPE AND POSITION, not by reading it. One
   component, two mounts - app/components/Gratitude.jsx is rendered by
   Wall.jsx and by this page. Not a copy. A rule restated in two places
   drifts; a component rendered in two places cannot, because there is
   only one of it (0046 -> 0047 -> 0049).

   ⚠️ NO redirect and no session check of its own. The middleware already
   sends an unauthenticated request to /login, and a second gate here
   would be a second implementation of the same rule. Gratitude.jsx
   renders null until the server answers, so there is nothing to flash.
   ===================================================================== */

export const metadata = {
  title: 'One good thing · Sober Book',
  /* Behind the login wall already. It is noindex for the same reason the
     check-in is: a page of things people are grateful for is exactly the
     sort of URL that should never turn up in a search result beside
     somebody's name - even though nothing on it carries one. */
  robots: { index: false, follow: false },
};

export default function GratitudePage() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to Home">&lsaquo;</Link>
        <span className="lg">One good thing</span>
      </div>
      <div className="pad">
        <GratitudeRoom />
      </div>
    </>
  );
}
