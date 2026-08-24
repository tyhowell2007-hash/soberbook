/* THE GREEN ROOM — your own page.

   See app/wall/layout.jsx for the full explanation. One of four.
   Carries the stylesheet, adds no markup. */
import '../theme-green.css';
import '../photos.css';
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
