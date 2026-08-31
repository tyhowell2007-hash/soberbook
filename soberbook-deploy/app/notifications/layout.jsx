/* ⚠️ theme-green first, then the page's own sheet — same order rule as
   /help and /readings. notifications.css reads variables out of the
   theme, so swapping these two lines leaves it styling against nothing.

   ⚠️ AND IT ISN'T FINISHED UNTIL IT RENDERS NavBar. /friends shipped on
   19 Aug with no way out of it. This is a page somebody opens hoping
   somebody answered them; if the answer is "nobody yet", a dead end is
   the last thing they should meet. */
import '../theme-green.css';
import '../notifications.css';
import NavBar from '../components/NavBar';

export default function NotificationsLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
