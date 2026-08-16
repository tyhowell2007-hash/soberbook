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

export default function WallLayout({ children }) {
  return children;
}
