/* 0202 — problem tickets. Green room theme + the tab bar, same as /more and
   /help. ⚠️ Without theme-green.css this page ships in the sign-in door's
   grunge look (the /more trap). */
import '../theme-green.css';
import '../tickets.css';
import NavBar from '../components/NavBar';

export default function TicketsLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
