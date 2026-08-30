/* ⚠️ theme-green, then help.css — same order rule as the readings page.
   help.css reads variables out of the theme, so swapping these two lines
   leaves it styling against nothing.

   ⚠️ AND IT ISN'T FINISHED UNTIL IT RENDERS NavBar. /friends shipped on
   19 Aug with no way out of it, and this page is one somebody reaches
   while upset — a dead end here is worse than a dead end anywhere. */
import '../theme-green.css';
import '../help.css';
import NavBar from '../components/NavBar';

export default function HelpLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
