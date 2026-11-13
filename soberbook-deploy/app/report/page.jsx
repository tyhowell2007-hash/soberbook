import Link from 'next/link';
import ReportForm from '../components/ReportForm';

/* =====================================================================
   /report — REPORT A PROBLEM. 0202, 13 Nov 2026.
   Reached from More, and from the "Report this problem" link inside an
   error, which passes ?cat=&screen=&error= so the ticket arrives already
   saying what failed. Signed out? middleware sends you to /login, and
   /support has the signed-out form.
   ===================================================================== */
export const metadata = { title: 'Report a problem · Sober Book' };
export const dynamic = 'force-dynamic';

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

export default function ReportPage({ searchParams }) {
  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back">←</Link>
        <span className="lg">report a problem</span>
      </div>
      <div className="bar">Something not working? Ty and Kenny see this right away.</div>
      <div className="pad">
        <ReportForm cat={clip(searchParams?.cat, 20)}
                    screen={clip(searchParams?.screen, 120)}
                    error={clip(searchParams?.error, 300)} />
        <p className="tk-foot">
          Somebody bothering you, or worried about someone? Use <b>⋯ → Report</b> on their post or
          profile instead. That goes to the safety queue. If you need someone right now, call or
          text <b>988</b>.
        </p>
      </div>
    </>
  );
}
