/* THE GREEN ROOM — Resources.  7 Sept.

   ⚠️ ORDER MATTERS: theme-green first. resources.css reads --gd, --gt,
   --gl, --gm-t, --soft, --paper, --paper2 and --line out of it, and if
   the imports swap every colour silently falls back to nothing.

   🔴 AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar. /friends
   shipped on 19 Aug with no way out of it, and /now's layout carries the
   same note. A page whose whole job is "I couldn't work out how to do
   the thing" must not itself be somewhere you get stuck. */
import '../theme-green.css';
import '../resources.css';
import NavBar from '../components/NavBar';

export default function ResourcesLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
