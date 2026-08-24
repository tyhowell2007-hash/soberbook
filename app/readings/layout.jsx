/* THE READINGS — the one room in the app that isn't the green room.

   ⚠️ theme-green IS STILL IMPORTED, and that's deliberate. It carries
   the bottom nav. A page that looks different reads as a choice; a page
   where the NAVIGATION also changes reads as broken.

   ⚠️ ORDER MATTERS. theme-green first, then readings.css — readings.css
   overrides the page surface and reads --soft out of it. Swap the two
   lines and the flyer treatment loses to the green one.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on Aug 19 with no way out of it. */
import '../theme-green.css';
import '../readings.css';
import NavBar from '../components/NavBar';

export default function ReadingsLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
