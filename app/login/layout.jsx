/* THE DOOR — /login.

   Mirror of the four green-room layouts. The root layout stays neutral and
   each area brings its own skin: the rooms import theme-green.css, the door
   imports door.css.

   door.css only styles things inside .door.back, so importing it here is
   safe for the grunge sign-up path too — a first-timer creating an account
   matches .door.first and none of the warm rules apply. */
import '../door.css';

export default function LoginLayout({ children }) {
  return children;
}
