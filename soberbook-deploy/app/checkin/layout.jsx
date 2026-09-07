/* THE GREEN ROOM — the check-in.  7 Sept.

   One of eight now (wall · me · welcome · u · chat · meetings · quiet ·
   checkin). See app/wall/layout.jsx for why the stylesheet is imported
   here and not in the root layout: CSS imported by a layout is scoped to
   that route segment, and the root layout paints the sign-in door, which
   stays grunge.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before pledge.css, because pledge.css reads --gd, --gl, --gt,
   --gm-t, --soft, --paper2 and --gm out of it. Swap these two lines and
   every colour on the card silently falls back to nothing — no error,
   just a page that looks broken.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on Aug 19 with no way out of it. */
import '../theme-green.css';
import '../pledge.css';
import NavBar from '../components/NavBar';

export default function CheckinLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
