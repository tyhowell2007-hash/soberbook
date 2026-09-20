import Link from 'next/link';

/* =====================================================================
   /more — THE TAB THAT REPLACED THE UNLABELLED ☰, 20 Sept.

   🔴 WHY THIS PAGE EXISTS. Everything a member does daily except the
   check-in lived behind a 52px hamburger with no word on it. Counted
   over 30 days, out of 339 members: Check in (a door on the home
   screen) 114 people, Gratitude 20, Tenth step 9, Your plan 2 ever.
   Same members, same app; the only difference was whether the door was
   on a screen they already look at.

   ⚠️ IT IS A PAGE, NOT A SHEET, AND THAT IS DELIBERATE. The drawer
   (MastMenu) still opens from the masthead and lists the same rows —
   but a drawer cannot be linked to, cannot be a tab, and disappears on
   any page without a masthead. This page can be reached by the bar from
   anywhere, and the back arrow returns you to the wall.

   ⚠️ IF YOU ADD A ROW HERE, ADD IT TO MastMenu TOO. Two lists is the
   price of having both a tab and a drawer; a row in only one of them is
   the "everything built except the way in" bug wearing a new hat.
   ===================================================================== */
const GROUPS = [
  {
    head: 'Your day',
    items: [
      { href: '/checkin',   label: 'Check in',          sub: 'How you’re doing today' },
      { href: '/gratitude', label: 'Gratitude',         sub: 'One good thing' },
      { href: '/tenth',     label: 'Tenth step',        sub: 'Look back at your day' },
      { href: '/plan',      label: 'Your safety plan',  sub: 'What to do on a hard day' },
    ],
  },
  {
    head: 'Quiet things',
    items: [
      { href: '/quiet',     label: '⛪ Quiet',          sub: 'No advice, no fixing' },
      { href: '/readings',  label: 'Daily readings',    sub: 'Something to read' },
      { href: '/resources', label: '◆ Ask Sage',        sub: 'Answers, any time' },
    ],
  },
  {
    head: 'People',
    items: [
      { href: '/find',          label: 'Find someone',   sub: 'Search by name or handle' },
      { href: '/circle',        label: '⭕ Your circle',  sub: 'The people who started when you did' },
      { href: '/notifications', label: 'What you missed', sub: 'Replies, messages, hellos' },
    ],
  },
  {
    head: 'This place',
    items: [
      { href: '/help',    label: 'Hotlines and help', sub: 'Places that aren’t us' },
      { href: '/rules',   label: 'The rules',         sub: 'What gets you removed' },
      { href: '/privacy', label: 'Privacy',           sub: 'What we keep, what we don’t' },
      { href: '/tour',    label: 'Take the tour',     sub: 'Everything the app does' },
      { href: '/support', label: 'Something’s broken', sub: 'Tell Ty' },
    ],
  },
];

export const metadata = { title: 'More · Sober Book' };

export default function MorePage() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">more</span>
      </div>
      <div className="bar">Everything else the app does</div>

      <div className="pad">
        {/* Her map leads, exactly as it does in the drawer — same row,
            same words. See MastMenu for why it claims she built the
            directory and not that she endorses Sober Book. */}
        <Link href="/find-care" className="mm-feature" style={{ margin: '0 0 10px' }}>
          <span className="mm-feat-t">Dr. Labor&rsquo;s Recovery Map</span>
          <span className="mm-feat-s">
            19,490 places to get help — treatment, detox and sober living,
            searchable by state and town. Nobody paid to be on it.
          </span>
        </Link>

        {GROUPS.map((g) => (
          <section key={g.head} className="mo-grp">
            <h2 className="mm-grp" style={{ padding: '14px 2px 4px' }}>{g.head}</h2>
            <div className="mo-card">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="mm-row mo-row">
                  <span className="mm-rt">{it.label}</span>
                  <span className="mm-rs">{it.sub}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
