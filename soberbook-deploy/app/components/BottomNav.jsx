'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* =====================================================================
   THE BOTTOM BAR.

   Ty asked for this after showing me the prototype, which has seven tabs:
   Home · Groups · Support · Jobs · Chats · Meet · You.

   ⚠️ THERE ARE TWO TABS HERE, NOT SEVEN, AND THAT IS DELIBERATE.

   Five of those seven are pictures of buttons. Groups, Support, Jobs,
   Chats and Meet have no pages, no tables and no code behind them. Putting
   them up would be the same category of mistake as "Verified, real
   people" — a promise the product can't keep, made to somebody who has no
   way of checking. Worse here, because a person in a bad moment tapping
   "Support" and getting nothing is the exact failure this app exists to
   avoid.

   So the bar carries the destinations that exist. As pages ship, tabs get
   added — and the bar grows into the shape of the prototype honestly,
   instead of starting there and lying about it.

   ---------------------------------------------------------------------
   WHY A CLIENT COMPONENT WHEN IT RENDERS NO STATE

   usePathname. The active tab has to be worked out in the browser, because
   the layouts that render this are shared across every route beneath them
   — Next keeps a layout mounted while the page inside it changes. A
   server-rendered "active" would be decided once, on the first page you
   landed on, and then stay wrong for the rest of the session.
   ===================================================================== */

const TABS = [
  { href: '/wall', icon: '🏠', label: 'Home' },
  { href: '/me',   icon: '🙂', label: 'You'  },
];

export default function BottomNav() {
  const path = usePathname() || '';

  return (
    /* <nav> with a real label, because a screen reader lands on a bare row
       of links with no idea it's the main navigation. */
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        /* /u/somebody is somebody else's page, not yours — "You" must not
           light up there. Exact match on /me, prefix match on /wall so a
           future /wall/whatever still counts as Home. */
        const active = t.href === '/me'
          ? path === '/me'
          : path === t.href || path.startsWith(t.href + '/');
        return (
          <Link key={t.href} href={t.href}
                className={'tab' + (active ? ' on' : '')}
                /* aria-current is what actually tells assistive tech which
                   one you're on. The colour change is for everybody else. */
                aria-current={active ? 'page' : undefined}>
            <span className="ti" aria-hidden="true">{t.icon}</span>
            <span className="tl">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
