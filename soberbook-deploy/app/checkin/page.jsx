import Link from 'next/link';
import Pledge from '../components/Pledge';

/* =====================================================================
   THE CHECK-IN, GIVEN A DOOR.  7 Sept.

   Ty, after looking at MyRecoveryPal: "I like how the check-in is built
   up above too, so it's easy to find and easy to get to."

   ⭐ HE IS POINTING AT THE ONE FEATURE THAT IS ALREADY WORKING, AND THE
   NUMBERS ARE WHY THIS PAGE EXISTS. 55 of 234 members have pledged, 82
   pledges in six days, and 67 of those carry words somebody chose to
   type. Meanwhile 180 of 230 have never posted or replied anywhere in
   the app. The pledge has more participation than the entire wall — and
   until today the only way to reach it was to open Home and hope it was
   still on screen, in a feed of sixty posts sorted by recency.

   ⚠️ THE CARD STAYS ON THE WALL. IT IS NOT MOVED HERE.

   That is the whole design of this page and it is a rule learned the
   hard way: on 3 Sept the inbox was reorganised without warning and Ty
   thought chat was broken, because people navigate a familiar surface by
   SHAPE AND POSITION, not by reading it. Fifty-five people currently
   find this card in one place. Taking it away to put it somewhere
   better is not an improvement to them, it is a loss.

   ⭐ SO THERE IS ONE COMPONENT AND TWO MOUNTS. app/components/Pledge.jsx
   is rendered by Wall.jsx and by this page. Not a copy — the same file.
   The rule this schema has been bitten by three times (0046 -> 0047 ->
   0049) is that a rule restated in two places drifts; a component
   rendered in two places cannot, because there is only one of it.

   ⚠️ NO redirect and no session check of its own. The middleware already
   sends an unauthenticated request to /login, and a second gate here
   would be a second implementation of the same rule. Pledge.jsx renders
   null until the server answers, so there is nothing to flash.
   ===================================================================== */

export const metadata = {
  title: 'Check in · Sober Book',
  /* Behind the login wall already, but a check-in page is exactly the
     sort of URL that should never appear in a search result next to
     somebody's name. */
  robots: { index: false, follow: false },
};

export default function CheckinPage() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to Home">‹</Link>
        <span className="lg">Check in</span>
      </div>
      <div className="pad">
        <Pledge />
        {/* ⚠️ Under the card, not above it. Somebody who came here to say
            one more day should meet the thing they came for first.

            🔴 And it is a LINK, not a repeat of the card. The evening
            review lives on the same card; duplicating it here would be
            the second implementation again. */}
        <p className="pl-priv" style={{ textAlign: 'center' }}>
          Nobody is ever told whether you checked in.
        </p>
      </div>
    </>
  );
}
