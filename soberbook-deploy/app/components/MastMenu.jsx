'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* =====================================================================
   EVERYTHING ELSE — the drawer.  18 Sept 2026.

   WHY THIS EXISTS. Nine features were hanging off exactly one link each:
   checkin · circle · gratitude · notifications · quiet · readings ·
   support · survey · tenth. Miss that one entry point and the feature may
   as well not be built. The bottom bar can't hold them — it is already at
   seven and wall.css calls eight a hard ceiling.

   ⚠️ IT MOUNTS IN THE ROOT LAYOUT, NOT IN EACH PAGE, AND THAT IS THE
   WHOLE DESIGN. Every one of the app's 24 mastheads is written by its own
   page, and 14 of them already put a back arrow in the right-hand slot.
   A button added to the right would have collided on most of the app; a
   button added per page would have been 24 edits and 24 chances to miss
   one. So the button is position:fixed over the LEFT of the masthead, and
   `html[data-menu="on"] .mast` pads the wordmark across to make room.
   Nothing in any page changes.

   ⚠️ THE LEFT SLOT, not the right, for that reason — and it is why this
   does not look like the back arrow. On this app back lives on the RIGHT
   (unusual, but established since August); putting a hamburger there too
   would have been two different meanings in one corner.

   🔴 RENDERS NOTHING WHEN SIGNED OUT. The door is grunge and has no
   theme-green, so every token this uses would be undefined there — and
   there is nothing behind the menu to go to anyway. The root layout
   passes `on` from the auth lookup it already does for the theme; this
   adds no query.
   ===================================================================== */

/* One list, in the order somebody would look for them. `soon` marks the
   two the bar already carries — they are NOT repeated here; a menu that
   lists what the bar lists teaches people the bar is incomplete. */
const GROUPS = [
  {
    head: 'Every day',
    items: [
      { href: '/checkin',   label: 'Check in' },
      { href: '/plan',      label: 'Your plan' },
      { href: '/tenth',     label: 'Tenth step' },
      { href: '/gratitude', label: 'Gratitude' },
    ],
  },
  {
    head: 'To read',
    items: [
      { href: '/readings',  label: 'Daily readings' },
      { href: '/resources', label: 'Resources' },
    ],
  },
  {
    head: 'This place',
    items: [
      { href: '/help',    label: 'Places that aren’t us' },
      { href: '/rules',   label: 'The rules' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/tour',    label: 'Take the tour' },
    ],
  },
];

export default function MastMenu({ on = false }) {
  const [open, setOpen] = useState(false);
  /* 🔴 NOT EVERY PAGE HAS A MASTHEAD, AND THE BUTTON IS position:fixed.

     Nine signed-in routes render no .mast at all — circle, now, privacy,
     readings, room, rules, support, survey, tour — and four of those are
     pages this very menu links to. A white icon pinned to the top-left
     corner of /privacy lands on the first line of legal text: invisible
     on a pale page, and sitting on top of the words either way. It would
     have shipped green and looked fine on every page I happened to open.

     So the button asks the page whether there is a masthead to sit on,
     rather than assuming. No route list to keep in step — a new page
     with a masthead gets the button for free, one without it is simply
     left alone, which is exactly today's behaviour. */
  const [hasMast, setHasMast] = useState(false);
  const path = usePathname();
  const btn = useRef(null);
  const panel = useRef(null);

  /* Close on navigation. Without this the drawer stays open over the page
     you just asked for, which reads as a broken link. */
  useEffect(() => { setOpen(false); }, [path]);

  /* Re-asked on every navigation, because the layouts differ per route. */
  useEffect(() => {
    setHasMast(!!document.querySelector('.mast'));
  }, [path]);

  useEffect(() => {
    if (!open) return;

    /* Escape closes. ⚠️ Scoped to the open state, so this app has no
       global keydown handler sitting on every page. */
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('keydown', key);

    /* ⚠️ Hold the page still underneath. Without this, scrolling inside
       the drawer scrolls the wall behind it on iOS and you close the menu
       to find you've lost your place in the feed. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /* Focus lands in the drawer, not left behind on the page. */
    const first = panel.current?.querySelector('a, button');
    first?.focus();

    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
      /* And comes back to the button that opened it. */
      btn.current?.focus();
    };
  }, [open]);

  /* ⚠️ Both conditions, and AFTER the hooks — a bare `return null` above
     them would change the hook order between renders and React would
     throw. */
  if (!on || !hasMast) return null;

  return (
    <>
      {/* 🔴 THE DOCK, AND WHY IT EXISTS.

          The first version pinned the button with `position:fixed; left:0`
          — the VIEWPORT's left edge. But this app is a centred 520px
          column, so on any desktop window the button landed out in the
          pale margin: measured 201px to the left of the masthead, a white
          icon on near-white paper. Invisible, and unclickable where it
          mattered.

          ⚠️ It passed every check I ran because I checked that the button
          EXISTED and that the masthead had padding — never where the
          button actually was. On a phone (≤520px) it happens to land
          right, which is why it looked fine.

          This dock is the same centring .tabbar uses (fixed, left:0,
          right:0, max-width:520px, margin:0 auto), so the button is
          anchored to the APP, not the window, and the two can never
          disagree. It has no height and no pointer events of its own. */}
      <div className="mm-dock" aria-hidden="false">
      <button
        ref={btn}
        type="button"
        className="mm-btn"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mm-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {open
            ? <path d="M6 6l12 12M18 6L6 18" />
            : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      </div>

      {open && (
        <>
          {/* The scrim is a real button so it is reachable by keyboard and
              announced, rather than a div with an onClick that Tab skips. */}
          <button type="button" className="mm-scrim" aria-label="Close menu"
                  onClick={() => setOpen(false)} />

          <div id="mm-panel" ref={panel} className="mm-panel"
               role="dialog" aria-modal="true" aria-label="Everything else">
            <div className="mm-head">
              <span className="mm-title">Everything else</span>
              <button type="button" className="mm-x" aria-label="Close menu"
                      onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="mm-list" aria-label="Everything else">
              {GROUPS.map((g) => (
                <div key={g.head}>
                  <h2 className="mm-grp">{g.head}</h2>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} className="mm-row">{it.label}</Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
