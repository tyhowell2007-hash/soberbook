/* THE GREEN ROOM — your own page.

   See app/wall/layout.jsx for the full explanation. One of four.
   Carries the stylesheet, adds no markup. */
import '../theme-green.css';
import '../photos.css';
/* One more day — the record above your song. Same file the Wall imports
   for the Home card; both routes need it, neither owns it. */
import '../pledge.css';
import NavBar from '../components/NavBar';

export default function MeLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
