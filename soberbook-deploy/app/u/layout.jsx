/* THE GREEN ROOM — other people's pages (/u/[handle]).

   See app/wall/layout.jsx for the full explanation. One of four.
   Covers every handle under /u because a layout applies to its whole
   subtree, including dynamic segments. */
import '../theme-green.css';
import '../photos.css';
import BottomNav from '../components/BottomNav';

export default function PublicProfileLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <BottomNav />
    </>
  );
}
