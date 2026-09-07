/* THE GREEN ROOM — your plan.  7 Sept.

   ⚠️ theme-green first: plan.css reads --gd, --gl, --gt, --gm, --gm-t,
   --soft, --paper, --paper2 and --body out of it. Swap the lines and
   every colour silently falls back to nothing.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on Aug 19 with no way out of it. */
import '../theme-green.css';
import '../plan.css';
import NavBar from '../components/NavBar';

export default function PlanLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
