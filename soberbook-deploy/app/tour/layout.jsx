/* THE WALKTHROUGH — layout.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before tour.css, because tour.css reads --gd, --gl, --gt, --soft,
   --body and --paper out of it. Swap these two lines and every colour on
   the page silently falls back to its hardcoded default — which looks
   almost right, which is worse than looking broken.

   ⚠️ AND NO NavBar HERE, which is the opposite of every other room
   layout in this app. /friends shipped on Aug 19 with no way out of it
   and that lesson stands — but this page is PUBLIC, and a nav bar on a
   public page is five links to a login wall. The way out is the "Go in"
   button, which is the way in. */
import '../theme-green.css';
import '../tour.css';

export default function TourLayout({ children }) {
  return <>{children}</>;
}
