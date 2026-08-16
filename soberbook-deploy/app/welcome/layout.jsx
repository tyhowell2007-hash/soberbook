/* THE GREEN ROOM — first run.

   See app/wall/layout.jsx for the full explanation. One of four.

   This one matters more than it looks. /welcome is the very first screen
   after the door — it's the moment the room is supposed to change. If
   this file is missing, somebody signs up through the loud grunge door
   and lands on another loud grunge screen, and the whole idea reads as
   an accident rather than a design. */
import '../theme-green.css';

export default function WelcomeLayout({ children }) {
  return children;
}
