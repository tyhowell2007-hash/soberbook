import '../../slip/slip.css';
import { db } from '../../../lib/rm/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meeting attendance record · Sober Book', robots: { index: false, follow: false } };

/* =====================================================================
   soberbook.app/slips/<id> — A MEMBER'S SHARED SLIPS.  9 Nov 2026 (0203),
   premium letterhead look.
   Open to people who aren't on Sober Book (a PO, a house manager), so the
   middleware lists '/slips/' as open. Only exists while the member keeps
   the link on.
   🔴 Shows only what shared_slips() returns: the name the member chose to
   print, and the slips. A link that's off and one that never existed draw
   the SAME page. Never the word "verified".
   ===================================================================== */
function parts(d) {
  const [y, m, dd] = String(d).split('-').map(Number);
  return new Date(y, m - 1, dd);
}
const fmtShort = (d) => parts(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtYear = (d) => parts(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDow = (d) => parts(d).toLocaleDateString('en-US', { weekday: 'short' });
function fmtTime(t) {
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

export default async function SharedSlips({ params }) {
  const id = String(params.share || '').toLowerCase();
  let rows = [];
  if (/^[0-9a-f]{32}$/.test(id)) {
    const { data } = await db().rpc('shared_slips', { p_share: id });
    rows = data || [];
  }
  if (rows.length === 0) {
    return (
      <div className="sl-pub">
        <div className="sl-sheet">
          <div className="sl-lhead"><div className="sl-logo">Sober Book</div><h1>Meeting attendance record</h1></div>
          <div className="sl-off"><b>Nothing to show</b><span>This link isn’t on, or there are no signed slips yet.</span></div>
        </div>
      </div>
    );
  }
  const label = rows[0].label;
  const days = rows.map((r) => String(r.slip_day)).sort();
  return (
    <div className="sl-pub">
      <div className="sl-sheet">
        <div className="sl-lhead">
          <div className="sl-logo">Sober Book</div>
          <h1>Meeting attendance record</h1>
          {label ? <div className="sl-who">{label}</div> : null}
        </div>
        <div className="sl-sum">
          <div><b>{rows.length}</b><span>Signed</span></div>
          <div><b>{fmtShort(days[0])}</b><span>First</span></div>
          <div><b>{fmtShort(days[days.length - 1])}</b><span>Latest</span></div>
        </div>
        <ul className="sl-rec">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="sl-dt">{fmtDow(r.slip_day)}<small>{fmtYear(r.slip_day)}</small></div>
              <div>
                <b>{r.meeting_name || 'Meeting'}</b>
                <span>Signed {fmtTime(r.signed_at)} by </span><span className="sl-sig">@{r.signer_handle}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="sl-foot">Each meeting was signed in person by the meeting’s chair, a Sober Book member, on their own phone. Sober Book is a recovery community. It doesn’t check who the chair is, and this isn’t a court document. The member can turn this link off at any time.</div>
      </div>
    </div>
  );
}
