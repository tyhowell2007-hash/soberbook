import '../rm/rm.css';
import Team from './Team';

export const metadata = { title: 'RecoveryMap team', robots: { index: false, follow: false } };

/* =====================================================================
   /rmteam — RecoveryMap's back room, inside Sober Book. 31 Oct 2026.
   For Ty and Kenny (Sober Book admins) and Dr. Labor (@theaddictsdoc,
   'doctor' in rm_reviewers).

   🔴 Signed-in only: the middleware sends anyone without a session to
   /login, and every rm_* team function checks the role again in the
   database. This page hides nothing a database check doesn't also refuse.
   ===================================================================== */
export default function Page() {
  return <div className="rm"><main className="wrap"><Team /></main></div>;
}
