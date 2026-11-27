import Link from 'next/link';
import CrisisRow from '../components/CrisisRow';
import BetaRow from '../beta/BetaRow';
import Banner from '../components/Banner';
import ForYouHub from './ForYouHub';
import './foryou.css';

/* =====================================================================
   /more — FOR YOU. 27 Nov 2026 (Kenny, Ty on board).

   This page was "More", the tab that replaced the unlabelled ☰ on
   20 Sept. Same address on purpose: every back arrow, the drawer and old
   links still land here. What changed is the shape:

   ⭐ ONE PLACE THAT EXPLAINS EVERYTHING. On a first open every tool is
   listed with one plain line on what it does, so nobody has to guess.
   Then the member can make it theirs: move what they use to the top,
   make a tool big or small, hide what they don't need. That arrangement
   is kept ON THIS PHONE only (localStorage), never in our database,
   because what somebody uses in recovery is nobody's business.

   🔴 988 STAYS FIRST. The CRCC ask (29 Oct) put the crisis row at the
   top of this page, and arranging can never move or hide it. Nor can it
   hide the small row of rules, privacy and support at the bottom.

   🔴 ONLY TOOLS THAT EXIST. Same rule as the bar (BottomNav): no tile for
   a page that isn't built. The Library and the private spaces join this
   list in the drops that ship them, not before.

   ⚠️ The drawer (MastMenu) still lists the same destinations. If a tool
   is added here, add it there too.
   ===================================================================== */

/* The order here is the order a new member sees. The resume builder
   leads and starts big: Kenny's ask, the tool he most wants people to
   know about. `id` must never change once shipped — it is the key a
   member's saved arrangement uses. */
const TOOLS = [
  { id: 'resume',   href: '/resume',        label: 'Resume builder',   sub: 'A professional resume, ready to send in minutes', hot: true, big: true },
  { id: 'care',     href: '/rm',            label: 'Find care',        sub: 'Treatment near you, from Dr. Nicole Labor’s directory', big: true },
  { id: 'checkin',  href: '/wall#pledge',   label: 'Check in',         sub: 'How you’re doing today' },
  { id: 'plan',     href: '/plan',          label: 'Your safety plan', sub: 'What to do on a hard day' },
  { id: 'readings', href: '/readings',      label: 'Daily readings',   sub: 'Something to read today' },
  { id: 'gratitude',href: '/gratitude',     label: 'Gratitude',        sub: 'One good thing' },
  { id: 'tenth',    href: '/tenth',         label: 'Tenth step',       sub: 'Look back at your day' },
  { id: 'quiet',    href: '/quiet',         label: '⛪ Quiet',          sub: 'No advice, no fixing' },
  { id: 'sage',     href: '/resources',     label: 'Ask Sage',         sub: 'Answers, any time' },
  { id: 'circle',   href: '/circle',        label: 'Your circle',      sub: 'The people who started when you did' },
  { id: 'find',     href: '/find',          label: 'Find someone',     sub: 'Search by name or handle' },
  { id: 'missed',   href: '/notifications', label: 'What you missed',  sub: 'Replies, messages, hellos' },
  { id: 'help',     href: '/help',          label: 'Hotlines and help',sub: 'Places that aren’t us' },
];

const FOOT = [
  { href: '/rules',   label: 'Rules' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/report',  label: 'Report a problem' },
  { href: '/tickets', label: 'My tickets' },
  { href: '/support', label: 'Support' },
];

export const metadata = { title: 'For You · Sober Book' };

export default function ForYouPage() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">for you</span>
      </div>
      <div className="bar">Everything Sober Book offers, in one place</div>
      <div className="pad fy-pad">
        <CrisisRow />
        {/* 0206 — Beta Lab, testers only (renders nothing for everyone else). */}
        <BetaRow />
        <ForYouHub tools={TOOLS} />
        <nav className="fy-foot" aria-label="About Sober Book">
          {FOOT.map((f) => <Link key={f.href} href={f.href}>{f.label}</Link>)}
        </nav>
        <Banner page="more" />
      </div>
    </>
  );
}
