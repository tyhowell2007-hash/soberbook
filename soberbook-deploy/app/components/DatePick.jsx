'use client';

import { useMemo } from 'react';

/* =====================================================================
   PICKING A DATE THAT WAS YEARS AGO.

   Ty, 29 Aug: "it has to go downwards... in years." And before that:
   "It should be a very easy procedure to put your sober date in."

   🔴 WHY <input type="date"> IS THE WRONG CONTROL HERE, SPECIFICALLY.
   A native date input opens on the CURRENT month. Every browser's
   fallback for getting to another year is stepping backwards a month at
   a time. Somebody twenty years sober is two hundred and forty taps from
   their own date. The control is fine for "pick a day next week" and
   actively hostile for "pick a day in 2004" — and this app is full of
   people whose date is a long way back. That is the whole argument.

   Three dropdowns, year newest-first, is one tap to any year.

   ---------------------------------------------------------------------
   ⚠️ ONE COMPONENT, THREE CALLERS: the counter's edit link, the
   "Counting days?" card, and sign-up. It exists as a component rather
   than three copies because this codebase has been bitten four times by
   the same shape — 0046 → 0047 → 0049, then the wall/drops read path —
   and the note in 0049 is the rule: a restatement is a second
   implementation, and the second one drifts. If the year range or the
   leap-year clamp ever changes, it changes here, once.

   ⚠️ VALUE IS ALWAYS 'YYYY-MM-DD' — the format `sober_since` stores and
   the format Me.jsx compares as a STRING to decide whether a date moved
   forward. Returning a Date object would break that comparison in a way
   that only shows up in the evening, when UTC and Ohio disagree about
   what day it is.
   ===================================================================== */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* How many days that month actually had. Day 0 of the NEXT month is the
   last day of this one — which is also how February gets 29 in a leap
   year without anybody writing a leap-year rule. */
function daysIn(month, year) {
  return new Date(year, month, 0).getDate();
}

export default function DatePick({ value, onChange, disabled, idPrefix = 'dp' }) {
  const now = new Date();
  const thisYear = now.getFullYear();

  /* ⚠️ Parsed by splitting the string, never with new Date(value).
     new Date('2022-08-02') is midnight UTC, which in Ohio is the evening
     of the 1st — so .getDate() would hand back the wrong day for part of
     every day. Same trap the movedForward comparison avoids. */
  const [y, m, d] = value
    ? value.split('-').map(Number)
    : [thisYear, now.getMonth() + 1, now.getDate()];

  const years = useMemo(() => {
    const out = [];
    for (let n = thisYear; n >= thisYear - 70; n--) out.push(n);
    return out;                       // newest first: the point of all this
  }, [thisYear]);

  const dim = daysIn(m, y);

  function emit(nm, nd, ny) {
    /* 🔴 CLAMP THE DAY. 31 January → February must not produce the 31st
       of February. Without this the value silently becomes 3 March and
       somebody's date is quietly wrong by two days. */
    const clamped = Math.min(nd, daysIn(nm, ny));
    onChange(
      `${ny}-${String(nm).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
    );
  }

  return (
    <div className="mdy">
      <select id={`${idPrefix}-m`} aria-label="Month" disabled={disabled}
              value={m} onChange={(e) => emit(+e.target.value, d, y)}>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>

      <select id={`${idPrefix}-d`} aria-label="Day" disabled={disabled}
              value={Math.min(d, dim)} onChange={(e) => emit(m, +e.target.value, y)}>
        {Array.from({ length: dim }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <select id={`${idPrefix}-y`} aria-label="Year" disabled={disabled}
              value={y} onChange={(e) => emit(m, d, +e.target.value)}>
        {years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
