/* PRIVATE SPACES — 27 Nov 2026 (Kenny, drop 3b). Green theme + the tab
   bar, same as /more and /library. */
import '../theme-green.css';
import './spaces.css';
import NavBar from '../components/NavBar';

export default function SpacesLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
