/* =====================================================================
   HOW LONG, IN THE MEMBER'S OWN TIME.  9 Oct 2026.

   ⚠️ THIS FILE EXISTS INSTEAD OF A CHANGE TO lib/milestones.js, AND THE
   REASON MATTERS.

   milestones.js is UTC on purpose and its own comment explains why:
   anniversaries are CALENDAR events, so "three years after 1 March 2024"
   has to be answered by adding 3 to a year, with both sides of every
   subtraction in the same zone. That is correct and nothing here touches
   it.

   What was wrong is a different question wearing the same clothes: not
   "when is their next chip" but "how long has it been, right now". That
   one is answered by a clock, and a clock belongs to the person holding
   it — not to UTC.

   🔴 THE BUG THIS FIXES. Both day counts in the app were
   `current_date - sober_since` with current_date in UTC:
   sober_days() in the database for somebody else's page, dayCount() in
   JavaScript for your own. UTC rolls over at 8pm in Ohio. So from 8pm
   until midnight every single night, every member east of UTC-4 was
   shown a number one higher than the truth — their count arrived about
   four hours early, every evening, and nobody would ever file it,
   because at breakfast it is always right.

   Verified on 9 Oct 2026 at 21:21 Eastern: the database returned 1529
   days by current_date and 1528 by America/New_York for the same member.

   ===================================================================== */

/* The UTC instant of midnight on `dateISO`, as the wall clock in `tz`
   read it.

   ⚠️ WHY TWO PASSES AND NOT ONE. The offset to apply depends on the
   instant, and the instant is what we are solving for — on a DST
   boundary the first correction can land an hour off, in the window
   where the offset itself changed. The second pass re-asks Intl about
   the corrected instant and settles it. Two is enough: the first pass
   is never more than an hour out, and no zone changes offset twice
   within an hour.

   ⚠️ `(+p.hour) % 24` is not decoration. Intl with hour12:false emits
   hour "24" for midnight in some engines rather than "00", and 24 would
   push the answer a whole day. */
export function zonedDayStart(dateISO, tz) {
  const parts = String(dateISO).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !n || Number.isNaN(n))) return null;
  const target = Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0);

  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    /* An unknown zone must not throw a profile page away. Fall back to
       UTC, which is exactly today's behaviour — no worse than before. */
    return target;
  }

  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = {};
    fmt.formatToParts(new Date(guess)).forEach((x) => { p[x.type] = x.value; });
    const seen = Date.UTC(+p.year, +p.month - 1, +p.day,
                          (+p.hour) % 24, +p.minute, +p.second);
    guess += (target - seen);
  }
  return guess;
}

/* THE ONE PAIR OF NUMBERS THE PROFILE NEEDS.

   `days`       whole days since the member's own midnight on day one
   `secsIntoDay` 0..86399, how far into their current day it is

   Together they are the clock. Kept as two integers rather than a
   timestamp on purpose: see the note in LiveClock.jsx — the browser is
   never told an absolute instant, so a phone with a wrong clock still
   shows the right time sober.

   Returns null for no date, and null for a date that has not arrived —
   same contract dayCount() already has, so every caller's existing
   "no number yet" branch keeps working untouched. */
export function soberNow(sinceISO, tz, now = Date.now()) {
  if (!sinceISO) return null;
  const start = zonedDayStart(sinceISO, tz);
  if (start === null) return null;

  const ms = now - start;
  if (ms < 0) return null;

  const total = Math.floor(ms / 1000);
  return { days: Math.floor(total / 86400), secsIntoDay: total % 86400 };
}
