/* THE LIBRARY — 27 Nov 2026 (Kenny, drop 2). Green theme + the tab bar,
   same as /more. Without theme-green.css the page ships in the sign-in
   door's grunge theme (the /more trap, see more/layout.jsx). */
import '../theme-green.css';
import './library.css';
import NavBar from '../components/NavBar';

export default function LibraryLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
