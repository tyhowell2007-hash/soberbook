/* THE GREEN ROOM — the Wall.

   One of four identical files (wall · me · welcome · u). Each one pulls
   theme-green.css in for its own segment only, which is what keeps the
   green off /login and /reset.

   Why a layout and not the root: in the App Router, CSS imported by a
   layout belongs to that route segment. The root layout paints every
   page including the sign-in door, and the door is supposed to stay
   grunge. Importing here scopes it to the room.

   ⚠️ Order still matters, and it still isn't visible from this file.
   globals.css and wall.css load in the root layout, so they're already
   in the document by the time this arrives. theme-green wins ties by
   being later. It does not replace the grunge — it reshapes it.

   Returning `children` unchanged is intentional: this layout exists only
   to carry the stylesheet. It adds no markup, so it can't affect layout,
   focus order, or anything a screen reader walks. */
import '../theme-green.css';
/* ⚠️ The record sheet's styles, split out of wall.css — see the header of
   dropsheet.css. Imported HERE rather than in the root layout because the
   sheet only ever opens from the wall, and the sign-in door has no
   business downloading it. */
import '../dropsheet.css';
/* AFTER theme-green, so photo rules can reshape green-room ones without
   reaching for !important. Same ordering argument as the note above. */
import '../photos.css';
/* The ad-card button. Its own small file rather than four more rules in
   wall.css — that file is 71KB and silently failed to upload three deploys
   running on Aug 23. Small files land. */
import '../adcard.css';
/* One more day — the pledge card at the top of Home. Also imported by
   app/me/layout.jsx, which renders the record above your song. ⚠️ Its own
   small file rather than a block in wall.css: see the note at its head. */
import '../pledge.css';
/* The ⋯ on a reply. Only the wall opens a thread, so only this layout
   needs it. ⚠️ Its own file rather than wall.css — see the note at its head. */
import '../replymenu.css';
import NavBar from '../components/NavBar';

export default function WallLayout({ children }) {
  return (
    <>
      {children}
      {/* A spacer in the flow, because the bar itself is fixed and would
          otherwise sit on top of the last post. Padding on <body> would
          have done it too, but body belongs to the root layout and the
          sign-in door has no bar to make room for. */}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
