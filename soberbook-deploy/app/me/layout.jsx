/* THE GREEN ROOM — your own page.

   See app/wall/layout.jsx for the full explanation. One of four.
   Carries the stylesheet, adds no markup. */
import '../theme-green.css';
import '../photos.css';
/* One more day — the record above your song. Same file the Wall imports
   for the Home card; both routes need it, neither owns it. */
import '../pledge.css';
/* The cream skin. Loads LAST so it wins; scoped to .mecream below. */
import './me-cream.css';
import NavBar from '../components/NavBar';

export default function MeLayout({ children }) {
  return (
    <>
      {/* .mecream scopes me-cream.css. The navpad sits inside so the
          space above the nav is cream too, not the green room's paper. */}
      <div className="mecream">
        {children}
        <div className="navpad" aria-hidden="true" />
      </div>
      <NavBar />
    </>
  );
}
