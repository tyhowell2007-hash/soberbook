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
/* 🔴 IMPORTED FOR EXACTLY ONE RULE: .tenth-door, the 10th-step doorway on
   the pledge card — and /checkin renders <Pledge />, so it needs this line
   just as much as app/wall/layout.jsx does.

   It shipped without it. The link was still there and still worked; it
   simply had no rule, so it rendered as plain text and lost
   `min-height: 44px`, which on a phone means the tap target shrank to the
   height of one line of type. Nothing errored, nothing looked broken
   enough to report — the exact silent-failure shape .phserr had on
   /meetings for weeks, and the shape the note in wall/layout.jsx warns
   about in capitals. Found by check-css-coverage.py, which is the only
   reason anybody found it at all. */
import '../tenth.css';
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
