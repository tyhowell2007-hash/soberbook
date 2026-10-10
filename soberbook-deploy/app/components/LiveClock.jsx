'use client';

import { useEffect, useRef, useState } from 'react';

/* =====================================================================
   THE TIME, RUNNING.  Ty's call, 9 Oct 2026 — option B2.

   The day number keeps the headline it has always had. This sits under
   it and counts hours, minutes and seconds, so somebody reading another
   member's page watches the time move instead of reading a figure.

   ---------------------------------------------------------------------
   🔴 THE SERVER NEVER GUESSES A SECOND, AND THAT IS THE WHOLE DESIGN.

   On 9 Oct 2026 /wall was throwing React #425 five times a load and then
   #423 — the root giving up on the server's HTML and re-rendering the
   whole page in the browser — because ago() in Wall.jsx calls Date.now()
   during render. The server stamps "52m", the browser hydrates in a
   different minute and stamps "53m", and React discards everything.

   A ticking clock is the most obvious possible way to ship that bug
   again. So:

     • `days` and `secsIntoDay` arrive as PROPS, computed once on the
       server by soberNow().
     • The first render — on the server, and the hydrating render in the
       browser — reads those props and nothing else. No Date.now()
       anywhere above the effect. The two renders cannot disagree,
       because neither one looks at a clock.
     • Only after mount does useEffect start moving.

   ⚠️ Do not be tempted to seed state with Date.now() to make the first
   frame a few hundred milliseconds fresher. That is the bug.

   ---------------------------------------------------------------------
   ⚠️ THE BROWSER IS NEVER TOLD WHEN THEY GOT SOBER.

   It receives "they are 1,528 days and 76,880 seconds in, as of the
   moment this page was built" and adds its own elapsed time to that. So
   a phone whose clock is an hour fast still shows the right time sober —
   it only has to measure how long the page has been open, which it can
   do correctly however wrong its idea of "now" is.

   That also keeps the member's timezone off the wire as an absolute
   instant. secsIntoDay does imply roughly what hour it is where they
   are, which is why the number is gated behind the same
   can_see_day_count() check the day count itself already uses: if
   they've chosen not to show you their count, you get no clock either.

   ⚠️ Date.now() and NOT performance.now() inside the effect, on purpose.
   performance.now() is monotonic but it stops while the device sleeps, so
   a phone shut in a pocket for eight hours would wake showing a clock
   eight hours behind. Wall-clock elapsed is the right measure here even
   though it can jump when the device syncs time — a jump self-corrects
   on the next tick; a sleep does not.
   ===================================================================== */

function two(n) { return (n < 10 ? '0' : '') + n; }

export default function LiveClock({ days, secsIntoDay }) {
  /* No date, or a date that hasn't arrived — Milestones already handles
     that case above this component. Belt and braces. */
  const ok = Number.isFinite(days) && Number.isFinite(secsIntoDay);

  /* Seeded from the props alone. See the note above. */
  const [t, setT] = useState(ok ? { d: days, s: secsIntoDay } : null);
  const base = useRef(null);
  const tick = useRef(null);
  const align = useRef(null);

  useEffect(() => {
    if (!ok) return undefined;

    base.current = { days, secsIntoDay, at: Date.now() };
    setT({ d: days, s: secsIntoDay });

    /* ⚠️ A number that changes every second IS motion. Somebody who has
       asked the system for less of it gets the reading they'd have got
       anyway — correct to the second the page was built — and no
       movement. Not a degraded clock: a still one. */
    let reduced = false;
    try {
      reduced = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    } catch { reduced = false; }
    if (reduced) return undefined;

    const paint = () => {
      const b = base.current;
      if (!b) return;
      const elapsed = Math.floor((Date.now() - b.at) / 1000);
      const total = b.days * 86400 + b.secsIntoDay + (elapsed > 0 ? elapsed : 0);
      setT({ d: Math.floor(total / 86400), s: total % 86400 });
    };

    const stop = () => {
      if (align.current !== null) { clearTimeout(align.current); align.current = null; }
      if (tick.current !== null) { clearInterval(tick.current); tick.current = null; }
    };

    /* Line the first tick up with the top of the second, so the seconds
       flip on the second rather than 400ms after it — and so every
       figure on the page flips together. */
    const start = () => {
      stop();
      paint();
      align.current = setTimeout(() => {
        align.current = null;
        paint();
        tick.current = setInterval(paint, 1000);
      }, 1000 - (Date.now() % 1000));
    };

    /* Nothing should be counting in a tab nobody is looking at. On the
       way back, paint() reads wall-clock elapsed, so it catches up in one
       frame rather than having to run through the missing seconds. */
    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) stop(); else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ok, days, secsIntoDay]);

  if (!ok || !t) return null;

  const h = Math.floor(t.s / 3600);
  const m = Math.floor((t.s % 3600) / 60);
  const s = t.s % 60;

  /* aria-hidden, and deliberately so. The day count and its label sit
     directly above this in .cn / .cl and are what a screen reader
     announces; a region that rewrites itself once a second would either
     be read aloud forever or have to be silenced anyway. Same rule the
     milestone bar already follows in this component's parent — the
     sentence is the information, the movement is decoration. */
  return (
    <div className="cols" aria-hidden="true">
      <div className="col"><div className="v">{two(h)}</div><div className="k">hours</div></div>
      <div className="col"><div className="v">{two(m)}</div><div className="k">minutes</div></div>
      <div className="col"><div className="v">{two(s)}</div><div className="k">seconds</div></div>
    </div>
  );
}
