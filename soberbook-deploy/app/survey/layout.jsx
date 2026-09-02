/* THE GREEN ROOM — survey.

   One of eight now (wall · me · welcome · u · chat · meetings · quiet ·
   survey). Same reason the stylesheet is imported here and not in the
   root layout: CSS imported by a layout is scoped to that route segment,
   and the root layout paints the sign-in door, which stays grunge.

   ⚠️ ORDER MATTERS AND ISN'T VISIBLE FROM THIS FILE. theme-green must
   come before survey.css, because survey.css reads --gd, --gl, --gt,
   --gm-t, --paper, --line and --soft out of it. Swap these two lines and
   every colour on the page silently falls back to nothing.

   ⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends
   shipped on 19 Aug with no way out of it. */
import '../theme-green.css';
import './survey.css';
import NavBar from '../components/NavBar';

export default function SurveyLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
