'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* =====================================================================
   THE BOTTOM BAR.

   Ty asked for this after showing me the prototype, which has seven tabs:
   Home · Groups · Support · Jobs · Chats · Meet · You.

   ⚠️ THERE ARE THREE TABS HERE, NOT SEVEN, AND THAT IS DELIBERATE.

   Four of those seven are still pictures of buttons. Groups, Support,
   Jobs and Meet have no pages, no tables and no code behind them. Putting
   them up would be the same category of mistake as "Verified, real
   people" — a promise the product can't keep, made to somebody who has no
   way of checking. Worse here, because a person in a bad moment tapping
   "Support" and getting nothing is the exact failure this app exists to
   avoid.

   So the bar carries the destinations that exist. As pages ship, tabs get
   added — and the bar grows into the shape of the prototype honestly,
   instead of starting there and lying about it. Chat is the first tab to
   earn its way in, on Aug 16.

   ---------------------------------------------------------------------
   WHY A CLIENT COMPONENT WHEN IT RENDERS NO STATE

   usePathname. The active tab has to be worked out in the browser, because
   the layouts that render this are shared across every route beneath them
   — Next keeps a layout mounted while the page inside it changes. A
   server-rendered "active" would be decided once, on the first page you
   landed on, and then stay wrong for the rest of the session.
   ===================================================================== */

/* `dot` names which key of the dots object lights this tab.

   ⚠️ "You" HAS NO DOT KEY, AND THAT IS THE POINT — Ty's call. A dot
   belongs where the thing IS. Home holds the reply, Chat holds the
   message, Meetings holds the room you said you'd be in. "You" holds
   your settings; nothing arrives there. Putting the signal on the tab
   that contains the actual person means one tap gets you to them,
   instead of to a list that sends you somewhere else. */
const TABS = [
  { href: '/wall',     icon: '🏠', label: 'Home',  dot: 'home',
    /* what the dot means, for a screen reader */
    said: 'someone replied to your post' },
  { href: '/chat',     icon: '💬', label: 'Chat',  dot: 'chat',
    said: 'you have a new message' },
  /* Aug 17. The second tab to earn its way in. It lists real meetings
     from NA's own open data — nothing here is a picture of a button.
     A chair, because that is what the room is: chairs in a circle. */
  { href: '/meetings', icon: '🪑', label: 'Meetings', dot: 'meetings',
    said: 'a meeting you said you’d be at is today' },
  /* no `dot` — see above */
  { href: '/me',       icon: '🙂', label: 'You'  },
];

/* =====================================================================
   THE DOT.

   ⚠️ A DOT, NOT A NUMBER, AND THIS IS THE WHOLE NOTIFICATION DESIGN IN
   ONE DECISION.

   A count is a score. It climbs, it nags, and it makes you feel behind on
   a thing that is supposed to be a room you walk into. "47" is a slot
   machine; a dot says only "there's something here" and then shuts up.
   The information a person actually needs is binary — is anyone waiting
   for me? — and a dot answers exactly that and nothing more.

   ⚠️ Do not "improve" this into a badge count. On a recovery app the
   climbing number is the harm.
   ===================================================================== */
export default function BottomNav({ dots = {} }) {
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
            <span className="ti" aria-hidden="true">
              {t.icon}
              {/* `t.dot &&` first: the You tab has no dot key at all, so it
                  can't light even if the server sent a stray field. The
                  absence of the key IS the rule, not a condition somebody
                  has to remember to write. */}
              {t.dot && dots[t.dot] && <i className="tdot" />}
            </span>
            <span className="tl">{t.label}</span>
            {/* The dot is decorative to the eye; this is how a screen
                reader is told the same thing — and it says WHAT is
                waiting, not just that something is. */}
            {t.dot && dots[t.dot] && (
              <span className="sr-only">— {t.said}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
