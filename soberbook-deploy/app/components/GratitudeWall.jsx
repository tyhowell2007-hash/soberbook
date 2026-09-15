'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE WALL - everything everybody put today, with nothing attached.
   15 Sept.  Reads gratitude_wall() and nothing else.

   🔴 IT IS NOT A LIST OF POSTS AND IT CANNOT BECOME ONE. gratitude_wall()
   returns TABLE(line text). There is no id in the result, so there is no
   key to heart, report, reply to or link to - not switched off, absent.
   Adding any of those is a change to 0154's function signature, and it
   should feel like one.

   ⚠️ THE ORDER IS THE FUNCTION'S, NOT OURS. It sorts by
   md5(member_id || grateful_on), which is a stable shuffle for the day:
   the same order all day, a different order tomorrow, and nobody's line
   permanently at the top. ⚠️ Do NOT sort or reverse this array here -
   said_at order would let somebody watching the page at 6:02am work out
   which member just opened the app, which is the whole reason the
   function does not return a timestamp.

   ⚠️ NO COUNT ABOVE IT. "14 people" on a day when it is 3 is the app
   telling a quiet room it is quiet. The lines are the number.
   ===================================================================== */

export default function GratitudeWall({ refreshKey }) {
  const [lines, setLines] = useState(null);

  useEffect(() => {
    let alive = true;
    browserClient().rpc('gratitude_wall').then(({ data }) => {
      if (!alive) return;
      setLines(Array.isArray(data) ? data.map((r) => r.line).filter(Boolean) : []);
    }).catch(() => { if (alive) setLines([]); });
    return () => { alive = false; };
    /* ⚠️ refreshKey changes when the member adds or removes their own
       line, so their own words appear here immediately instead of after a
       reload. Nothing polls - this wall has no reason to move while
       somebody is reading it. */
  }, [refreshKey]);

  if (lines === null) return null;

  /* ⚠️ An empty day says so plainly rather than rendering nothing.
     Silence and absence look identical to somebody at 2am and only one of
     them is true - the same argument as the meetings failure card. */
  if (lines.length === 0) {
    return (
      <p className="gr-empty">
        Nobody has put anything up yet today. Yours can be the first.
      </p>
    );
  }

  return (
    <ul className="gr-wall">
      {lines.map((line, i) => (
        /* ⚠️ The index is the key and that is correct here: the list is
           anonymous by construction, there is no id to use, and it never
           reorders while it is on screen. */
        <li key={i} className="gr-line">{line}</li>
      ))}
    </ul>
  );
}
