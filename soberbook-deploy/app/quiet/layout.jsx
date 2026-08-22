/* THE GREEN ROOM — quiet.

   One of seven now (wall · me · welcome · u · chat · meetings · quiet).
   See app/wall/layout.jsx for why the stylesheet is imported here and
   not in the root layout: CSS imported by a layout is scoped to that
   route segment, and the root layout paints the sign-in door, which
   stays grunge.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before quiet.css, because quiet.css reads --gd, --gl, --gt,
   --gm-t and --soft out of it. Swap these two lines and every colour on
   the page silently falls back to nothing.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on Aug 19 with no way out of it. */
import '../theme-green.css';
import '../quiet.css';
import NavBar from '../components/NavBar';

export default function QuietLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
