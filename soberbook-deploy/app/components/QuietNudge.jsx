'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   SAY HI TO SOMEBODY QUIET — 9 Nov 2026 (Kenny + Ty, guided experience).

   "Your people" on /me already sorts quietest-first and says "7 of them
   have been quiet a while" — but only people who open /me ever see it.
   This puts ONE of those names on Home, right after the day's check-in,
   with a single tap into the conversation.

   ⚠️ SAME DATA, SAME RULES AS /me. my_friends() only ever returns your
   own friends to you, so this reveals nothing /me doesn't already show
   you. Same two-week threshold (AWHILE in app/me/People.jsx).
   ⚠️ NOT A NOTIFICATION, AND "Not today" IS RESPECTED. Members were
   promised no reminders or nudges to come back; this is a card inside
   the app they already opened, and dismissing it hides it until tomorrow.
   Renders nothing for anybody without a quiet friend (most members).
   ===================================================================== */
const AWHILE = 14;
const KEY = 'sb_quiet_nudge_hidden';
const today = () => new Date().toISOString().slice(0, 10);

export default function QuietNudge() {
  const [p, setP] = useState(null);

  useEffect(() => {
    let alive = true;
    try { if (localStorage.getItem(KEY) === today()) return; } catch { /* private window */ }
    (async () => {
      try {
        const { data } = await browserClient().rpc('my_friends');
        const q = (data || []).find((f) => f.handle && !f.never_talked && (f.quiet_days ?? 0) >= AWHILE);
        if (alive && q) setP(q);
      } catch { /* nothing shown */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!p) return null;
  const name = p.display_name || `@${p.handle}`;
  const hide = () => { try { localStorage.setItem(KEY, today()); } catch {} setP(null); };

  return (
    <div className="qn">
      <p className="qn-t"><b>{name}</b> has been quiet {p.quiet_days} days.</p>
      <div className="qn-a">
        <Link className="qn-go" href={`/chat?to=${encodeURIComponent(p.handle)}`}>Say hi</Link>
        <button type="button" className="qn-no" onClick={hide}>Not today</button>
      </div>
    </div>
  );
}
