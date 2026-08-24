/* THE GREEN ROOM — chat.

   See app/wall/layout.jsx for the full explanation. One of five now.

   Chat is inside the app, so it wears the room, not the door. The grunge
   stylesheet is deliberately not imported anywhere below /login. */
import '../theme-green.css';
import NavBar from '../components/NavBar';

export default function ChatLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
