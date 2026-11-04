'use client';

// Live sober counter for member profiles.
// Self-contained: it adds nothing to existing pages until it is placed in one.
// Usage: <LiveSoberCounter soberSince={profile.sober_since} />
// soberSince can be an ISO date string, a timestamp, or a Date.
// If soberSince is missing or invalid, nothing is shown.

import { useEffect, useMemo, useState } from 'react';
import styles from './LiveSoberCounter.module.css';

const MILESTONES = [
  [1, '24 hours'],
  [7, '1 week'],
  [30, '30 days'],
  [60, '60 days'],
  [90, '90 days'],
  [180, '6 months'],
  [365, '1 year'],
  [730, '2 years'],
  [1825, '5 years'],
];

const DAY = 86400;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function LiveSoberCounter({ soberSince }) {
  const start = useMemo(() => toDate(soberSince), [soberSince]);
  // Time is only read in the browser so server and client render the same markup.
  const [now, setNow] = useState(null);

  useEffect(() => {
    if (!start) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [start]);

  if (!start) return null;

  const total = now === null ? 0 : Math.max(0, Math.floor((now - start.getTime()) / 1000));
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  let prev = 0;
  let next = null;
  for (const m of MILESTONES) {
    if (days < m[0]) {
      next = m;
      break;
    }
    prev = m[0];
  }
  if (!next) {
    next = [days + 365, 'Next year'];
    prev = days;
  }
  const left = next[0] * DAY - total;
  const span = Math.max(1, (next[0] - prev) * DAY);
  const pct = Math.min(1, Math.max(0, 1 - left / span));

  const sinceText = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const label = `${days} ${days === 1 ? 'day' : 'days'}, ${hours} ${hours === 1 ? 'hour' : 'hours'} sober`;

  return (
    <section className={styles.wrap} aria-label="Sober time">
      <div className={styles.counter} role="timer" aria-label={label}>
        <div className={`${styles.cell} ${styles.main}`}>
          <b>{now === null ? '–' : days}</b>
          <span>{days === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className={styles.cell}>
          <b>{now === null ? '–' : pad(hours)}</b>
          <span>Hrs</span>
        </div>
        <div className={styles.cell}>
          <b>{now === null ? '–' : pad(minutes)}</b>
          <span>Min</span>
        </div>
        <div className={styles.cell}>
          <b>{now === null ? '–' : pad(seconds)}</b>
          <span>Sec</span>
        </div>
      </div>

      <p className={styles.live}>
        <i className={styles.dot} aria-hidden="true" />
        Sober since {sinceText}
      </p>

      <div className={styles.ms}>
        <div className={styles.msRow}>
          <span>Next milestone: {next[1]}</span>
          {now !== null && (
            <span>
              {Math.floor(left / DAY)}d {pad(Math.floor((left % DAY) / 3600))}h left
            </span>
          )}
        </div>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
          aria-label={`Progress to ${next[1]}`}
        >
          <i style={{ width: `${pct * 100}%` }} />
        </div>
        <ul className={styles.badges}>
          {MILESTONES.slice(0, 7).map(([d, name]) => (
            <li key={d} className={days >= d ? styles.got : undefined}>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
