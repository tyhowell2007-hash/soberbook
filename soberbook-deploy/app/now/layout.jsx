/* THE GREEN ROOM — Right now.  7 Sept.

   See app/wall/layout.jsx for why theme-green is imported here and not
   in the root layout: CSS imported by a layout is scoped to that route
   segment, and the root layout paints the sign-in door, which stays
   grunge.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come first — quiet.css and now.css both read --gd, --gl, --gt, --gm,
   --gm-t, --soft, --paper and --paper2 out of it. Swap the lines and
   every colour silently falls back to nothing.

   🔴 quiet.css IS NOT OPTIONAL AND IT IS NOT DECORATION. Now.jsx
   renders /quiet's Practice component — the same file, not a copy — and
   every class that component draws (.pr-wrap, .pr-mark, .pr-when,
   .pr-title, .pr-steps, .pr-breath, .pr-circle, .pr-cue, .pr-note,
   .pr-back, .pr-stop, .pr-done) is defined only in quiet.css. Remove
   this import and the build stays green, nothing errors, and somebody
   at 3am gets a wall of unstyled text. This is the /meetings .phserr
   bug and the emoji-tray bug, both of which shipped exactly this way.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on Aug 19 with no way out of it. That matters more here than
   anywhere: this page must never feel like somewhere you are stuck. */
import '../theme-green.css';
import '../quiet.css';
import '../now.css';
import NavBar from '../components/NavBar';

export default function NowLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
