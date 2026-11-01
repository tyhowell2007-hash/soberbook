/* =====================================================================
   TALK ROOMS — live voice in the rooms. 1 Nov 2026.
   Ty: "I would like to make something for virtual talking with people."

   Its own layout so talks.css only loads here, and every rule in it is
   under .talkx anyway (wall.css owns half the short class names in this
   app — the .crow/.bub lesson). Carries NavBar like every room layout.
   ===================================================================== */
import '../theme-green.css';
import '../talks.css';
import NavBar from '../components/NavBar';

export const metadata = { title: 'Talk Rooms · Sober Book' };

export default function TalksLayout({ children }) {
  return (
    <>
      <div className="talkx">{children}</div>
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
