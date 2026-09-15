/* THE GREEN ROOM - your 10th step.  15 Sept.

   One of ten now (wall - me - welcome - u - chat - meetings - quiet -
   checkin - gratitude - tenth). See app/wall/layout.jsx for why the
   stylesheet is imported here and not in the root layout: CSS imported
   by a layout is scoped to that route segment, and the root layout
   paints the sign-in door, which stays grunge.

   ⚠️ ORDER MATTERS AND IT ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before tenth.css, because tenth.css reads --gd, --gl, --gt,
   --soft, --paper2, --line and --x out of it. Swap these two lines and
   every colour silently falls back to nothing - no error, just a page
   that looks broken.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar - /friends
   shipped on Aug 19 with no way out of it.

   🔴 tenth.css is imported TWICE across the app: here, and in
   app/wall/layout.jsx, which needs exactly one rule from it (.tenth-door,
   the link on the pledge card). Removing either line strips one of the
   two surfaces, and a stylesheet nothing imports is a silent failure this
   app has hit three times. */
import '../theme-green.css';
import '../tenth.css';
import NavBar from '../components/NavBar';

export default function TenthLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
