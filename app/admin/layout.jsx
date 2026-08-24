/* THE GREEN ROOM — the moderation queue.

   Fifth of the per-segment theme files (wall · me · welcome · u · admin).
   See app/wall/layout.jsx for why the import lives in a layout rather
   than the root.

   ⚠️ No BottomNav here on purpose. The bar is Home · Chat · Meetings ·
   You — the four places a member goes. Moderation is not a fifth place;
   it's a back room, reached by typing the address. Putting it in the nav
   would show a tab to everybody and hide it for all but one person,
   which is the sort of thing that leaks the moment a screenshot gets
   shared. */
import '../theme-green.css';
import '../photos.css';
import '../admin.css';

export default function AdminLayout({ children }) {
  return <>{children}</>;
}
