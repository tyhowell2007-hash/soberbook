/* THE GREEN ROOM — meetings.

   One of six now (wall · me · welcome · u · chat · meetings). See
   app/wall/layout.jsx for why the stylesheet is imported here and not in
   the root layout: CSS imported by a layout is scoped to that route
   segment, and the root layout paints the sign-in door, which stays
   grunge.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before meetings.css, because meetings.css reads --gd, --gl, --gt
   and --gm-t out of it. Swap these two lines and every colour on the page
   silently falls back to nothing. */
import '../theme-green.css';
import '../meetings.css';
import NavBar from '../components/NavBar';

export default function MeetingsLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
