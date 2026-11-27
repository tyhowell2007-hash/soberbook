'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { track } from '../../lib/track';
import { RESOURCES, noteScreen, noteOpen, popupFor, popupAllowedNow,
         markPopupShown, tapped, snoozed } from '../../lib/right-moment';
import './right-moment.css';
import '../more/foryou.css';

/* =====================================================================
   "RIGHT MOMENT RESOURCES" — THE POP-UP. 27 Nov 2026 (Kenny, drop 3).

   A sheet that slides up right after a member does something, listing
   up to three tools that fit, most useful first. One tap each. "Not now"
   closes it and rests those tools for that reason for 7 days.

   Mounted once in the root layout. It also:
   • notes each screen opened (so a tool already found is never pitched)
   • notes each app open (welcome_back after 5+ days away)

   Moments arrive as a window event, sb:moment, fired by moment() in
   lib/right-moment.js — from the check-in card and the wall's milestone.

   ⚠️ Never on the sign-in door, the crisis pages, or inside a reader:
   a pop-up over somebody reading or in crisis is the wrong moment.
   ===================================================================== */

const QUIET_PATHS = ['/login', '/reset', '/sign', '/welcome', '/now', '/help', '/checkin', '/library/'];

export default function RightMoment({ on }) {
  const path = usePathname() || '';
  const [open, setOpen] = useState(null); // { reason, items, safety }

  useEffect(() => { if (on) noteScreen(path); }, [on, path]);

  useEffect(() => {
    if (!on) return;
    const reasons = noteOpen();
    if (reasons.includes('welcome_back')) {
      /* Wait out the 2-minute rule, then offer it once if still fitting. */
      const t = setTimeout(() => fire({ reason: 'welcome_back' }), 2 * 60 * 1000 + 500);
      return () => clearTimeout(t);
    }
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  function fire(detail) {
    const reason = detail.reason;
    const here = window.location.pathname;
    if (QUIET_PATHS.some((p) => here === p || here.startsWith(p.endsWith('/') ? p : p + '/'))) return;
    if (reason !== 'hard_checkin' && !popupAllowedNow()) return;
    const { items, safety } = popupFor(reason, detail);
    if (!items.length && !safety) return;
    markPopupShown();
    setOpen({ reason, items, safety });
    items.forEach((r) => track('moment.shown', { resource: r, reason }));
  }

  useEffect(() => {
    if (!on) return;
    const h = (e) => fire(e.detail || {});
    window.addEventListener('sb:moment', h);
    return () => window.removeEventListener('sb:moment', h);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') notNow(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on || !open) return null;

  function notNow() {
    open.items.forEach((r) => { snoozed(r, open.reason); track('moment.snooze', { resource: r, reason: open.reason }); });
    setOpen(null);
  }
  function go(r) {
    tapped(r, open.reason);
    track('moment.tap', { resource: r, reason: open.reason });
    setOpen(null);
  }

  return (
    <div className="rm-scrim" onClick={(e) => { if (e.target === e.currentTarget) notNow(); }}>
      <section className="rm-sheet" role="dialog" aria-modal="true" aria-labelledby="rm-h">
        <div className="rm-grab" aria-hidden="true" />
        <h2 id="rm-h" className="rm-h">Right moment resources</h2>
        {open.safety && (
          <a className="rm-safe" href="tel:988">
            <b>Need someone right now?</b> Call or text 988, any hour →
          </a>
        )}
        <ul className="rm-list">
          {open.items.map((r) => {
            const x = RESOURCES[r];
            return (
              <li key={r}>
                <Link href={x.href} className={'rm-item' + (x.hot ? ' hot' : '')} onClick={() => go(r)}>
                  <span className="rm-il">{x.label}</span>
                  <span className="rm-is">{x.sub}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="rm-more">
          Everything else lives in{' '}
          <Link href="/more" className="fy-chip" onClick={() => track('moment.foryou', { reason: open.reason })}>For You</Link>
        </p>
        <button type="button" className="rm-no" onClick={notNow}>Not now</button>
      </section>
    </div>
  );
}
