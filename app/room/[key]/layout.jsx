/* A room, so it wears the green — and it carries the bottom bar, because
   a room layout isn't finished until it renders NavBar (learned by
   shipping /friends without one on Aug 19). */
import '../../theme-green.css';
import '../../photos.css';
import '../../meetings.css';
import NavBar from '../../components/NavBar';

export default function RoomLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
