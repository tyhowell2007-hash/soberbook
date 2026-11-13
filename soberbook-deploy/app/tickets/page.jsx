import Link from 'next/link';
import { serverClient } from '../../lib/supabase-server';
import { catLabel, MEMBER_STATUS, ticketNo } from '../../lib/tickets';

/* =====================================================================
   /tickets — MY TICKETS. 0202, 13 Nov 2026.
   Your own problem tickets, where each one stands, and every reply from
   Ty or Kenny. Read through my_tickets(), which only ever returns the
   signed-in member's own.
   ===================================================================== */
export const metadata = { title: 'My tickets · Sober Book' };
export const dynamic = 'force-dynamic';

function when(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export default async function MyTickets() {
  const supabase = serverClient();
  const { data } = await supabase.rpc('my_tickets');
  const list = Array.isArray(data) ? data : [];

  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back">←</Link>
        <span className="lg">my tickets</span>
      </div>
      <div className="bar">Problems you&rsquo;ve told us about</div>
      <div className="pad">
        {list.length === 0 && (
          <div className="tk-empty">
            <h2>No tickets yet.</h2>
            <p>If something in the app isn&rsquo;t working, tell us and it shows up here.</p>
          </div>
        )}
        {list.map((t) => {
          const st = MEMBER_STATUS[t.status] || MEMBER_STATUS.new;
          return (
            <article key={t.num} className="tk-card">
              <div className="tk-row">
                <b>{ticketNo(t.num)} · {catLabel(t.category)}</b>
                <span className={'tk-st ' + st.cls}>{st.text}</span>
              </div>
              <small className="tk-when">
                Sent {when(t.created_at)}{t.fixed_at ? ` · fixed ${when(t.fixed_at)}` : ''}
              </small>
              <p className="tk-desc">{t.description}</p>
              {(t.replies || []).map((r, i) => (
                <div key={i} className="tk-reply"><b>{r.who}:</b> {r.body}</div>
              ))}
            </article>
          );
        })}
        <Link href="/report" className="btn tk-new">Report a problem</Link>
      </div>
    </>
  );
}
