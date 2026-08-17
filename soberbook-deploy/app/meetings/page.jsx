import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { fetchMeetings, SOURCE } from '../../lib/meetings';
import List from './List';

/* =====================================================================
   MEETINGS.

   ⚠️ THIS PAGE IS BEHIND THE LOGIN AND IT IS noindex, ON PURPOSE.

   The feed hands us live Zoom links with passwords baked into them:

     https://us02web.zoom.us/j/83249566714?pwd=cVBVek10SXZmTUt...

   Those are published in good faith by the service body, for apps exactly
   like this one to display. Meeting Guide and a dozen BMLT clients render
   the same links. Using them is the intended use.

   But Zoom-bombing of recovery meetings is a real, documented thing, and
   the reason it happens is that links get harvested off crawlable pages.
   If Sober Book put this list somewhere Google indexes, we'd have turned
   somebody else's good-faith data into a harvesting surface — and the
   people who'd pay for it are addicts in a meeting, not us.

   Auth was already here for the green room, so the gate is free. The
   noindex is one line. There is no excuse for skipping either.
   ===================================================================== */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Meetings',
  robots: { index: false, follow: false, nocache: true },
};

export default async function MeetingsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { ok, reason, meetings, fetchedAt } = await fetchMeetings();

  /* WHO'S GOING. The view, never the table — reading meeting_going
     directly would return raw member_id uuids for people who blocked you.
     meeting_attendance joins through public_profiles, so blocking,
     suspension and anonymous mode are all inherited rather than
     re-implemented here (which is how you get one of them subtly wrong).

     ⚠️ Failure here must NOT take the page down. If this query errors,
     the meeting list still renders — somebody looking for a meeting at
     2am gets the meeting, and simply doesn't see who else is going. The
     social layer is the nice part; the list is the necessary part. */
  let going = [];
  try {
    const { data } = await supabase
      .from(assertReadable('meeting_attendance'))
      .select('source, meeting_id, occurs_on, handle, display_name, display_avatar, is_mine')
      .eq('source', SOURCE.id)
      .limit(500);
    going = data || [];
  } catch { going = []; }

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">meetings</span>
      </div>
      <div className="bar">Online · join from anywhere · nobody here sees that you went</div>

      {/* ⚠️ FAIL LOUDLY, NEVER QUIETLY.

          If the feed is unreachable this says so. It does NOT render an
          empty list. "No meetings found" and "we couldn't reach the
          server" look identical to somebody at 2am and only one of them
          is true — and the false one tells a person in a bad moment that
          there is nowhere to go tonight. */}
      {!ok ? (
        <div className="pad">
          <div className="mt-down">
            <div className="mt-downh">Couldn&apos;t load the meeting list</div>
            <p>
              This isn&apos;t you and it isn&apos;t your connection — the list comes from
              a volunteer-run server and we couldn&apos;t reach it just now.
            </p>
            <p>
              <b>There are still meetings running right now.</b> The fellowships keep
              their own finders going:
            </p>
            <p className="mt-outs">
              <a href="https://virtual-na.org/" target="_blank" rel="noopener noreferrer">Virtual NA ↗</a>
              <a href="https://aa-intergroup.org/meetings/" target="_blank" rel="noopener noreferrer">Online AA ↗</a>
            </p>
            <p className="mt-dim">Technical reason: {reason}</p>
          </div>
        </div>
      ) : (
        <List meetings={meetings} fetchedAt={fetchedAt} source={SOURCE} going={going} />
      )}
    </>
  );
}
