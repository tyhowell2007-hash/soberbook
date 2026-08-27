'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
/* ⭐ The SAME component the Chat tab uses. One implementation, two
   mounts — see the note in page.jsx. Its base styles live in
   wall.css, which the ROOT layout imports, so it is already loaded
   here. (Checked, rather than assumed — the Aug 19 rule about a
   stylesheet needing the right layout applies to per-route sheets,
   and this one isn't.) */
import Directory from '../chat/Directory';

/* =====================================================================
   YOUR PEOPLE — sorted by silence.

   ⭐ THE ONE IDEA: every friends list ever built sorts by who is loudest.
   Most recent, most active, most engaging. This one puts the person you
   have not heard from at the TOP.

   Ty, on why: "you can check up on other people if they've been quiet for
   a long time and see if they're okay."

   A feed is built to surface the people who are already fine. In this
   room, the person who went quiet is the one worth a message — and no
   engagement algorithm will ever find them, because silence is the exact
   opposite of the thing those are built to see.

   ---------------------------------------------------------------------
   ⚠️ WHOLE DAYS, NEVER CLOCK TIMES.

   "about 3 weeks", never "last seen 2:14am". The Aug 16 decision against
   green dots said a presence signal publishes when a vulnerable person is
   awake and alone. Days can't rebuild somebody's schedule; timestamps can.

   ⚠️ AND ONLY YOU SEE THIS ORDER. Nobody is ever told they are at the top
   of somebody's neglected list. That would be a cruel thing to build.
   ===================================================================== */

/* Deliberately vague. "22 days" invites you to watch a number climb;
   "about three weeks" invites you to send a message. Same reason the nav
   uses a dot instead of a count. */
function quietly(days) {
  if (days === 0) return 'talked today';
  if (days === 1) return 'talked yesterday';
  if (days < 7)   return `talked ${days} days ago`;
  if (days < 14)  return 'quiet about a week';
  if (days < 31)  return `quiet about ${Math.round(days / 7)} weeks`;
  if (days < 365) return `quiet about ${Math.round(days / 30)} months`;
  return 'quiet over a year';
}

/* The threshold for "it's been a while". Two weeks is long enough that it
   isn't nagging you about somebody you spoke to on Tuesday, short enough
   to still be a check-in rather than an autopsy. */
const AWHILE = 14;

function Face({ p }) {
  return p.avatar_photo && p.avatar_kind === 'photo'
    ? <span className="frface frface-photo" aria-hidden="true" />
    : <span className="frface" aria-hidden="true">{p.avatar || '🌱'}</span>;
}

function Row({ p, warm }) {
  return (
    <li className={'frrowitem' + (warm ? ' warm' : '')}>
      <Link href={`/u/${p.handle}`} className="frwho">
        <Face p={p} />
        <span className="frmeta">
          <span className="frname">{p.display_name}</span>
          <span className="frwhen">
            {p.never_talked ? 'never talked' : quietly(p.quiet_days)}
          </span>
        </span>
      </Link>
      {/* Straight into the conversation. The whole page exists to make
          this one tap easy; a list you have to navigate out of to act on
          is a list nobody acts on. */}
      <Link href={`/chat?to=${encodeURIComponent(p.handle)}`} className="frsay">
        Say hi
      </Link>
    </li>
  );
}

export default function Friends({ initialFriends, initialRequests, everyone = [] }) {
  const supabase = browserClient();
  const [friends] = useState(initialFriends || []);
  const [reqs, setReqs] = useState(initialRequests || []);
  const [busy, setBusy] = useState('');

  async function answer(handle, yes) {
    setBusy(handle);
    try {
      await supabase.rpc(yes ? 'accept_friend' : 'ignore_friend',
                         { target_handle: handle });
      setReqs((r) => r.filter((x) => x.handle !== handle));
    } finally { setBusy(''); }
  }

  const quiet   = friends.filter((f) => f.never_talked || f.quiet_days >= AWHILE);
  const rest    = friends.filter((f) => !f.never_talked && f.quiet_days < AWHILE);
  const soon    = friends.filter((f) => f.milestone_date);

  return (
    <div className="frwrap">

      {/* ---- requests first: somebody is waiting on you ---- */}
      {reqs.length > 0 && (
        <>
          <h2 className="frsec">Asked to be your friend</h2>
          <ul className="frlist">
            {reqs.map((p) => (
              <li key={p.handle} className="frrowitem warm">
                <Link href={`/u/${p.handle}`} className="frwho">
                  <Face p={p} />
                  <span className="frmeta">
                    <span className="frname">{p.display_name}</span>
                    <span className="frwhen">@{p.handle}</span>
                  </span>
                </Link>
                <span className="frtwo">
                  {/* Same size, both of them. You shouldn't have to hunt
                      for the quieter option. */}
                  <button type="button" className="btn tiny"
                          disabled={busy === p.handle}
                          onClick={() => answer(p.handle, true)}>Accept</button>
                  <button type="button" className="btn tiny out"
                          disabled={busy === p.handle}
                          onClick={() => answer(p.handle, false)}>Ignore</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">
            If you ignore someone, they aren’t told, and they can’t ask again.
          </p>
        </>
      )}

      {/* ⚠️ THIS USED TO SAY "Nobody yet." AND STOP.

          It was true about your friends list and a lie about the room —
          there were six other people the whole time. One line now, and it
          points DOWN the page instead of off it. */}
      {friends.length === 0 && (
        <p className="hint frnone">
          No friends yet — that&apos;s fine. Everybody on Sober Book is
          below; say hi to anyone.
        </p>
      )}

      {/* ---- the point of the page ---- */}
      {quiet.length > 0 && (
        <>
          <h2 className="frsec warm">It’s been a while</h2>
          <ul className="frlist">
            {quiet.map((p) => <Row key={p.handle} p={p} warm />)}
          </ul>
        </>
      )}

      {soon.length > 0 && (
        <>
          <h2 className="frsec">Coming up</h2>
          <ul className="frlist">
            {soon.map((p) => (
              <li key={'m' + p.handle} className="frrowitem gold">
                <Link href={`/u/${p.handle}`} className="frwho">
                  <Face p={p} />
                  <span className="frmeta">
                    <span className="frname">{p.display_name}</span>
                    <span className="frwhen">
                      {p.milestone_days >= 365
                        ? `${Math.round(p.milestone_days / 365)} year${p.milestone_days >= 730 ? 's' : ''}`
                        : `${p.milestone_days} days`}
                      {' '}on {new Date(p.milestone_date + 'T12:00:00')
                        .toLocaleDateString('en-US', { weekday: 'long' })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* ⚠️ Only people who chose to show their day count appear here.
              A milestone IS a day count — see 0041. */}
        </>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="frsec quiet">Everyone else</h2>
          <ul className="frlist">
            {rest.map((p) => <Row key={p.handle} p={p} />)}
          </ul>
        </>
      )}

      {friends.length > 0 && (
        <p className="hint frfoot">
          Sorted by who you haven’t talked to longest. Only you see this order.
        </p>
      )}

      {/* ---- EVERYBODY ----
          Last, deliberately. Your people and the person you haven't heard
          from in a fortnight come first — that ordering is the whole spin
          of this page and everybody-in-the-room doesn't get to outrank it.

          ⚠️ No presence dots here either. The Aug 16 refusal was about the
          chat directory and it travels with the component: a green dot
          says not just who is vulnerable but when they are awake and
          alone. Every signal on these rows — "new here", "Posted today",
          the chip — comes from something the person chose to do in
          public. */}
      {everyone.length > 0 && (
        <>
          <h2 className="frsec">Everybody on Sober Book</h2>
          <Directory members={everyone} />
        </>
      )}

    </div>
  );
}
