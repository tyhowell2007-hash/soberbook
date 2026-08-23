/* THE DOOR — /login.

   Mirror of the four green-room layouts. The root layout stays neutral and
   each area brings its own skin: the rooms import theme-green.css, the door
   imports door.css.

   ⚠️ Aug 23: door.css is GONE from this route. The three doors it styled
   were replaced by one page carrying both (see login/page.jsx for why —
   it cost real members). door.css still styles /reset, which is still a
   coming-back-in moment, so the file stays. */
import '../landing.css';

export default function LoginLayout({ children }) {
  return children;
}
