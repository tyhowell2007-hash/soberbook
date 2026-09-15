/* THE GREEN ROOM - one good thing.  15 Sept.

   One of nine now (wall · me · welcome · u · chat · meetings · quiet ·
   checkin · gratitude). See app/wall/layout.jsx for why the stylesheet is
   imported here and not in the root layout: CSS imported by a layout is
   scoped to that route segment, and the root layout paints the sign-in
   door, which stays grunge.

   ⚠️ ORDER MATTERS AND IT ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before gratitude.css, because gratitude.css reads --gd, --gl,
   --gt, --soft, --paper2 and --line out of it. Swap these two lines and
   every colour on the card silently falls back to nothing - no error,
   just a page that looks broken. Exactly the note on checkin/layout.jsx.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar - /friends
   shipped on Aug 19 with no way out of it.

   🔴 A STYLESHEET NOTHING IMPORTS IS A SILENT FAILURE THIS APP HAS HIT
   THREE TIMES (/meetings drew .phserr naked for weeks, the emoji tray
   shipped unstyled, .gone had no rules at all). gratitude.css is imported
   TWICE on purpose - here, and in app/wall/layout.jsx, because the CARD
   lives on Home and the WALL lives here. Removing either line strips one
   of the two surfaces. */
import '../theme-green.css';
import '../gratitude.css';
import NavBar from '../components/NavBar';

export default function GratitudeLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
