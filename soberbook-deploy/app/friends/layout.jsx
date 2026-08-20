/* A room, not a door — so it wears the green. See app/wall/layout.jsx for
   why the theme import lives in a per-segment layout rather than the root
   one: the root would paint the sign-in door too.

   ⚠️ AND IT CARRIES THE BOTTOM BAR. Shipped without it the first time and
   caught it on the live page: you could reach /friends from the nav and
   then have no nav to leave by. Every room layout in this app renders
   NavBar; a new one is only finished when it does too. */
import '../theme-green.css';
import '../photos.css';
import '../friends.css';
import NavBar from '../components/NavBar';

export default function FriendsLayout({ children }) {
  return (
    <>
      {children}
      {/* Spacer in the flow, because the bar is fixed and would otherwise
          sit on top of the last row. */}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
