'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '../../lib/track';
import { RESOURCES, nudgeFor, claimNudgeDay, markNudgeShown, todaysNudge,
         lateNightsNow, allowed, tapped, snoozed, moment } from '../../lib/right-moment';
import '../more/foryou.css';

/* =====================================================================
   "HAVE YOU TRIED…" — ONE TOOL, IN THIS MEMBER'S OWN FEED. 27 Nov 2026.

   Takes over the wall's nudge slot once the member has opened For You
   (ForYouNudge owns it until then). Same look, same two-days-a-week cap
   (they share sb_fy_nudge_days), same "Not for me" = 7 days for that
   tool and reason. Each untried tool gets one turn before any gets a
   second; the resume builder goes first. A tool they've opened is never
   pitched again. Rules live in lib/right-moment.js.

   Also hands the wall's milestone to the pop-up: `mark` is today's chip
   (from milestoneToday on the server), so the "Right moment resources"
   sheet can offer the resume builder (from 90 days) and the Library.
   ===================================================================== */

export default function ToolNudge({ days, mark }) {
  const [pick, setPick] = useState(null);

  useEffect(() => {
    if (mark) moment('milestone', { days: mark });
  }, [mark]);

  useEffect(() => {
    let seen = null;
    try { seen = localStorage.getItem('sb_fy_seen'); } catch { /* fine */ }
    if (!seen) return; // ForYouNudge has the slot
    const late = lateNightsNow();
    const again = todaysNudge();
    if (again && allowed(again.res, again.reason)) { setPick(again); return; }
    const n = nudgeFor({ days, lateNights: late });
    if (!n || !claimNudgeDay()) return;
    markNudgeShown(n.res, n.reason);
    setPick(n);
    track('nudge.shown', { resource: n.res, reason: n.reason });
  }, [days]);

  if (!pick) return null;
  const r = RESOURCES[pick.res];

  function notForMe() {
    snoozed(pick.res, pick.reason);
    track('nudge.snooze', { resource: pick.res, reason: pick.reason });
    setPick(null);
  }

  return (
    <aside className="fy-nudge" aria-label="Did you know">
      <span className="fy-nk">Did you know?</span>
      <p className="fy-nt">{r.nudge}</p>
      <p className="fy-ns">{r.nudgeSub}</p>
      <div className="fy-nb">
        <Link href={r.href} className="fy-ngo"
              onClick={() => { tapped(pick.res, pick.reason); track('nudge.tap', { resource: pick.res, reason: pick.reason }); }}>
          Open {r.label} →
        </Link>
        <button type="button" className="fy-nno" onClick={notForMe}>Not for me</button>
      </div>
    </aside>
  );
}
