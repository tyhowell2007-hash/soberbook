'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LiveSoberCounter.module.css';

/* =====================================================================
   THE LIVE SOBER COUNTER — a member's profile, Option B refined.
   Kenny's first drop (PR #11, 3 Nov 2026), finished the same night.

   Days on a white tile in the member's own colour, hours / minutes /
   seconds ticking beside it, a ring filling toward the next chip, and
   the chip row underneath.

   ---------------------------------------------------------------------
   🔴 3 NOV — WHY THIS NO LONGER TAKES A SOBER DATE.

   The first version took `soberSince` and did `new Date('2025-11-03')`.
   That string is read as MIDNIGHT IN LONDON, so for every member in the
   US the "Sober since" line showed the day before, and every evening the
   day count jumped one too high. Same bug the main clock had on 9 Oct.

   It also put the member's sober date in the browser. LiveClock.jsx's
   rule is that the browser is never told when somebody got sober — it
   gets "N days and S seconds in, as of when this page was built" and
   adds its own elapsed time. So this component now takes exactly that:

     days         public_profiles.day_count
     secsIntoDay  public_profiles.secs_into_day (THEIR midnight, their
                  timezone, gated by the same can_see_day_count() check)
     next, pct, chips   worked out on the server from lib/milestones.js,
                  so the chips here are the same chips as everywhere else

   🔴 NO Date.now() ABOVE THE EFFECT. The server render and the hydrating
   render read only the props, so they cannot disagree (the 9 Oct #425 /
   #423 bug). The clock starts moving after mount. Reduced motion = a
   still reading, correct to the second the page was built.
   ===================================================================== */

const DAY = 86400;
const two = (n) => (n < 10 ? '0' : '') + n;

export default function LiveSoberCounter({ days, secsIntoDay = null, next = null,
                                           pct = 0, chips = [] }) {
  const okDays = Number.isFinite(days);
  const ticking = okDays && Number.isFinite(secsIntoDay);

  // Seeded from the props alone — see the note above.
  const [t, setT] = useState({ d: okDays ? days : 0, s: ticking ? secsIntoDay : 0 });
  const base = useRef(null);

  useEffect(() => {
    if (!ticking) return undefined;
    base.current = { at: Date.now(), total: days * DAY + secsIntoDay };
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) return undefined;
    const step = () => {
      const total = base.current.total + Math.floor((Date.now() - base.current.at) / 1000);
      setT({ d: Math.floor(total / DAY), s: total % DAY });
    };
    let id = null;
    const align = setTimeout(() => { step(); id = setInterval(step, 1000); }, 1000 - (Date.now() % 1000));
    return () => { clearTimeout(align); if (id) clearInterval(id); };
  }, [ticking, days, secsIntoDay]);

  if (!okDays) return null;

  const h = Math.floor(t.s / 3600), m = Math.floor((t.s % 3600) / 60), s = t.s % 60;
  // The chips were worked out for the day the page was built; if the page
  // has been open across their midnight, count the gap down by the same day.
  const rolled = t.d - days;
  const away = next ? Math.max(0, next.daysAway - rolled) : null;
  const frac = Math.max(0, Math.min(1, pct / 100));
  const R = 24, C = 2 * Math.PI * R;

  return (
    <section className={styles.sc} aria-label="Time sober">
      <div className={styles.head}>
        <span className={styles.live}><i className={styles.dot} aria-hidden="true" />
          {ticking ? 'Sober right now' : 'Sober'}</span>
        <span className={styles.dayword}>Day {(t.d + 1).toLocaleString()}</span>
      </div>

      <div className={styles.tiles} role="timer"
           aria-label={`${t.d.toLocaleString()} ${t.d === 1 ? 'day' : 'days'} sober`}>
        <div className={`${styles.t} ${styles.days}`}>
          <div className={styles.num}>{t.d.toLocaleString()}</div>
          <div className={styles.lab}>{t.d === 1 ? 'Day' : 'Days'}</div>
        </div>
        {ticking && (
          <>
            <div className={styles.t}><div className={styles.num}>{two(h)}</div><div className={styles.lab}>Hrs</div></div>
            <div className={styles.t}><div className={styles.num}>{two(m)}</div><div className={styles.lab}>Min</div></div>
            <div className={styles.t}><div className={styles.num}>{two(s)}</div><div className={styles.lab}>Sec</div></div>
          </>
        )}
      </div>

      {next && (
        <div className={styles.foot}>
          <div className={styles.ring} role="img"
               aria-label={`${away.toLocaleString()} ${away === 1 ? 'day' : 'days'} to the ${next.full} chip`}>
            <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
              <circle cx="29" cy="29" r={R} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="6" />
              <circle cx="29" cy="29" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 29 29)" />
            </svg>
            <span className={styles.pc} aria-hidden="true">{Math.round(frac * 100)}%</span>
          </div>
          <div className={styles.next} aria-hidden="true">
            <b>{away.toLocaleString()} {away === 1 ? 'day' : 'days'} to {next.full}</b>
            <span>Next milestone on the way</span>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul className={styles.chips}>
          {chips.map((mk) => (
            <li key={mk.key} className={mk.earned ? styles.chip : `${styles.chip} ${styles.chipNext}`}
                aria-label={mk.full + (mk.earned ? ', earned' : ', next')}>
              <span aria-hidden="true">{mk.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
