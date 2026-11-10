'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/* =====================================================================
   THE DOORS — one row at the top of Home.  9 Nov 2026 (Kenny).

   Home used to open on TWO rows of buttons — Right now · Check in · Ask
   Sage, then Gratitude · Tenth step · Readings · Your plan — seven doors
   before "Welcome home". Check in and Gratitude are now tabs on the "say
   it" card, so those two were duplicates, and the rest made the first
   thing anybody saw a menu.

   Now it is one row: Right now · ◆ Ask Sage · More for today. The third
   door opens the daily tools in place, right under it.

   🔴 "RIGHT NOW" STAYS FIRST AND ALWAYS VISIBLE. Somebody opening this app
   in trouble must never read past anything — or open anything — to reach
   the crisis door. Same rule as before; only the daily habits moved.

   ⚠️ THE DAILY TOOLS ARE ONE TAP AWAY, NOT BEHIND MORE. The 20 Sept note in
   page.jsx is why: behind an unlabelled ☰ they got 20, 9 and 2 taps in 30
   days against 114 for a door on the screen. This door is labelled and on
   the screen, and the same tools are also offered where they're useful
   (the 10th step and the day's reading on the done pledge card, the
   craving practice and safety plan when the craving is strong).

   ⚠️ It remembers open/closed per phone (localStorage, wrapped — it can
   throw or come back empty, and the row must work either way).
   ===================================================================== */

const KEY = 'sb_today_open';

export default function Doors() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { if (window.localStorage.getItem(KEY) === '1') setOpen(true); } catch { /* storage blocked */ }
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* storage blocked */ }
      return next;
    });
  }

  return (
    <>
      <div className="bar bar-doors">
        <Link href="/now" className="dr dr-now">Right now</Link>
        <Link href="/resources" className="dr dr-ask">◆ Ask Sage</Link>
        <button type="button" className="dr dr-in dr-more"
                aria-expanded={open} aria-controls="today-tools" onClick={toggle}>
          More for today <span className="dr-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </div>
      {open && (
        <div className="bar bar-today" id="today-tools" aria-label="For today">
          <Link href="/tenth" className="td">🔟<span>Tenth step</span></Link>
          <Link href="/readings" className="td">📖<span>Readings</span></Link>
          <Link href="/plan" className="td">🧭<span>Your plan</span></Link>
          <Link href="/quiet" className="td">⛪<span>Quiet</span></Link>
        </div>
      )}
    </>
  );
}
