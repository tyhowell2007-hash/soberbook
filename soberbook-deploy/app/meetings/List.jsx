'use client';

import { useEffect, useState } from 'react';

/* =====================================================================
   WHAT'S ON NEXT.

   ⚠️ WHY THIS IS A CLIENT COMPONENT WHEN IT RENDERS NO FORM

   Timezones. The server has no idea what time it is where you are — it
   runs in whatever region Vercel put it, and if it rendered "8:00 PM" it
   would be printing its own clock at you. Only the browser knows your
   zone. So the server ships the raw facts (a weekday, an hour, and the
   meeting's own zone) and the browser does the arithmetic.

   ⚠️ AND WHY IT'S SORTED BY "NEXT", NOT BY DAY

   A grid of Sunday-through-Saturday tabs answers "what happens Tuesday".
   Nobody opens this page to ask that. They open it at half eleven on a
   bad night to ask "where can I go, now". So the list is ordered by what
   starts soonest, and the first thing on it is the closest door.
   ===================================================================== */

const MS_DAY = 86400000;
const WD = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };

function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}

/* Turn a wall-clock time in some zone into a real instant.

   ⚠️ The loop is not superstition. There is no built-in "this local time,
   in that zone, is this UTC moment" — Intl only goes the other way. So we
   guess, ask what the guess looks like over there, and correct by the
   error. Twice, because correcting once can land on the far side of a DST
   boundary and be an hour out. Two passes settles it.

   Getting this wrong by an hour twice a year would put somebody outside a
   meeting that already ended. That's the whole reason for the second
   iteration. */
function zonedToUtc(y, mo, d, hh, mi, tz) {
  let ts = Date.UTC(y, mo - 1, d, hh, mi);
  for (let i = 0; i < 2; i++) {
    const g = partsIn(new Date(ts), tz);
    const seen = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute);
    ts -= seen - ts;
  }
  return ts;
}

function nextStart(m, nowMs) {
  if (!m.tz) return null;
  for (let add = 0; add <= 7; add++) {
    const g = partsIn(new Date(nowMs + add * MS_DAY), m.tz);
    if (WD[g.weekday] !== m.day) continue;
    const ts = zonedToUtc(+g.year, +g.month, +g.day, m.hour, m.minute, m.tz);
    /* A meeting that started up to 20 minutes ago still counts. Walking
       in late is normal and always has been; hiding it would be the app
       being stricter than the rooms are. */
    if (ts >= nowMs - 20 * 60000) return ts;
  }
  return null;
}

function whenLabel(ts, nowMs) {
  const mins = Math.round((ts - nowMs) / 60000);
  if (mins <= 0 && mins > -20) return { t: 'Started just now', live: true };
  if (mins < 60) return { t: `In ${mins} min`, live: true };

  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date(nowMs);
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = d.toDateString() === new Date(nowMs + MS_DAY).toDateString();

  if (sameDay)  return { t: `Today ${time}`, live: false };
  if (tomorrow) return { t: `Tomorrow ${time}`, live: false };
  return { t: `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`, live: false };
}

export default function List({ meetings, fetchedAt, source }) {
  /* ⚠️ null until mounted, on purpose. The server has no clock that means
     anything to this reader, so it renders no times at all — if it
     guessed and the browser disagreed, React would throw a hydration
     mismatch and the page would flicker between two different wrong
     answers. Empty, then correct, beats wrong then corrected. */
  const [rows, setRows] = useState(null);
  const [showClosed, setShowClosed] = useState(true);

  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      const out = [];
      for (const m of meetings) {
        const ts = nextStart(m, now);
        if (ts == null) continue;   // no zone we trust → not shown with a time
        out.push({ ...m, ts, when: whenLabel(ts, now) });
      }
      out.sort((a, b) => a.ts - b.ts);
      setRows(out.slice(0, 60));
    };
    compute();
    /* Re-run every minute so "In 12 min" doesn't quietly become a lie
       while somebody sits reading the page. */
    const id = setInterval(compute, 60000);
    return () => clearInterval(id);
  }, [meetings]);

  if (rows === null) {
    return <div className="pad"><p className="mt-dim">Working out the times where you are…</p></div>;
  }

  const shown = showClosed ? rows : rows.filter((r) => r.access !== 'closed');

  return (
    <div className="pad">

      {/* ⚠️ THE OPEN/CLOSED CONTROL EXISTS BECAUSE OF WHO ELSE IS HERE.

          A closed meeting is for people who have the addiction themselves.
          Ty, Aug 17: some members won't have a sober date — they're here
          for somebody else, or to understand it. Sending one of them to a
          closed meeting means she shows up and is asked to leave.

          It defaults to SHOWING everything, because most members here do
          have the addiction and hiding half the list from them by default
          would be the wrong guess in the other direction. The switch is
          how you say which one you are, without telling the app which one
          you are — nothing about this choice is stored or sent anywhere. */}
      <button type="button" className="mt-filter" aria-pressed={!showClosed}
              onClick={() => setShowClosed((v) => !v)}>
        {showClosed ? 'Show only meetings open to everyone' : 'Showing open meetings only · show all'}
      </button>

      {shown.length === 0 && (
        <p className="mt-dim">Nothing in the next seven days matches that. Try showing all.</p>
      )}

      {shown.map((m) => (
        <div key={m.id} className={'mt-card' + (m.when.live ? ' now' : '')}>
          <div className="mt-when">{m.when.t}</div>
          <div className="mt-name">{m.name}</div>

          <div className="mt-tags">
            {m.access === 'open' && <span className="mt-tag open">Open to anyone</span>}
            {m.access === 'closed' && <span className="mt-tag closed">For people in recovery</span>}
            {/* ⚠️ 'unknown' is shown as unknown. Not quietly omitted, and
                definitely not rounded up to "open" — that's the guess that
                gets somebody turned away at a door. */}
            {m.access === 'unknown' && <span className="mt-tag unk">Not stated — ask the group</span>}
            {m.minutes ? <span className="mt-tag dur">{m.minutes} min</span> : null}
          </div>

          {m.note && <div className="mt-note">{m.note}</div>}

          <div className="mt-go">
            {m.link && (
              /* noreferrer as well as noopener: the meeting host has no
                 business learning that the click came from a recovery app. */
              <a className="mt-join" href={m.link} target="_blank" rel="noopener noreferrer">
                Join ↗
              </a>
            )}
            {m.phone && <span className="mt-phone">{m.phone}</span>}
          </div>
        </div>
      ))}

      {/* Attribution is not decoration. These are volunteers who published
          their data so apps could use it; the least we do is say whose it
          is and send people back to them. */}
      <div className="mt-src">
        <p>
          Meeting times and links come from <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>,
          who publish them openly so apps like this can list them. Sober Book isn&apos;t
          affiliated with {source.fellowship} and doesn&apos;t speak for them.
        </p>
        <p className="mt-dim">
          {fetchedAt ? `List checked ${new Date(fetchedAt).toLocaleString()}. ` : ''}
          Groups change times without telling anybody — if one is wrong, the
          fellowship&apos;s own finder is the source of truth.
        </p>
      </div>
    </div>
  );
}
