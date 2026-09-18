/* A room, not a door — so it wears the green. See app/wall/layout.jsx.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come first, because findcare.css reads --gd, --gl, --gt, --gm-t and
   --paper2 out of it. Swap these two lines and every colour on the page
   silently falls back to nothing. */
import '../theme-green.css';
import '../findcare.css';
import NavBar from '../components/NavBar';

export default function FindCareLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
