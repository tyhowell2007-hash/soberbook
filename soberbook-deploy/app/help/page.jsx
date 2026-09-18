import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'If you need somebody — Sober Book' };

/* =====================================================================
   THE PAGE OF THINGS THAT AREN'T US.

   Built alongside The Front Porch (0097), and it is the more useful half.
   A room is a place to be heard over days. What a frightened parent needs
   at eleven at night is a phone number, and until now the app had none.

   ---------------------------------------------------------------------
   🔴 EVERY ORGANISATION HERE IS SOMEBODY ELSE'S, AND THE PAGE SAYS SO.

   Al-Anon and Alateen are registered trademarks of Al-Anon Family Group
   Headquarters, Inc.; permission to use the name belongs to registered
   Al-Anon groups. Sober Book is not one. So this page NAMES them, LINKS
   to them, and states plainly that they have nothing to do with us.

   ⭐ Pointing at them is generous. Implying we are them is the same
   failure as "verified, real people" on the landing page and the drop
   card that said "Sober Book first" over a song already released. The
   app does not make claims on somebody else's behalf.

   ---------------------------------------------------------------------
   🔴 NO REFERRAL TRACKING. NOT NOW, NOT LATER.

   There is no campaign tag, no click counter, no analytics on any link
   below. In a field where treatment centres pay for referrals, a tracked
   outbound link is the first step towards being paid to point somewhere —
   and EKRA makes that a federal matter, quite apart from what it would do
   to the reason anybody trusts this room.

   ⚠️ If somebody ever asks how many people clicked GRASP, the answer is
   that we deliberately cannot know.

   ---------------------------------------------------------------------
   ⚠️ EVERY NUMBER AND URL WAS READ FROM THE ORGANISATION, not recalled.
   The 20 Aug meetings bug — every time four hours wrong — came from
   trusting a derivation instead of a source.
   ===================================================================== */

/* ⭐ tel: LINKS, NOT PRINTED DIGITS. The 20 Aug meetings work found 29
   published phone numbers and not one of them was tappable — plain text
   you copied by hand, at the moment you are least able to. Somebody
   holding a phone at 2am should touch the number once. */
const NOW = [
  {
    name: 'Partnership to End Addiction',
    what: 'Free and confidential, English and Spanish. They also run free four-week coaching by text or phone, and the coaches are parents who have been through this themselves.',
    tel: '+18553784373',
    shown: '1-855-DRUGFREE',
    href: 'https://drugfree.org/get-support/',
  },
  {
    name: '988 — Suicide & Crisis Lifeline',
    what: 'Call or text, any hour. For you, or for them.',
    tel: '988',
    shown: '988',
    href: null,
  },
];

const ROOMS = [
  {
    name: 'Al-Anon and Nar-Anon',
    what: 'Meetings for families and friends — in person, by phone and online. The oldest and largest of these, and the one most people mean when they ask.',
    href: 'https://al-anon.org/',
  },
  {
    name: 'PAL — Parents of Addicted Loved Ones',
    what: 'Free weekly meetings, specifically for parents of adult children. Groups across Ohio.',
    href: 'https://palgroup.org/',
  },
  {
    name: 'GRASP',
    what: 'For people who have lost someone to addiction or overdose. Meetings across the US and Canada. If that is why you are here, this is the room for it — not ours.',
    href: 'https://grasphelp.org/',
  },
  {
    name: 'SMART Recovery Family & Friends',
    what: 'Secular, and built on CRAFT — skills for encouraging someone toward treatment rather than detaching from them. Free.',
    href: 'https://smartrecovery.org/family',
  },
];

export default async function HelpPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/friends" className="rt melink">‹ back</Link>
      </div>
      <div className="bar">Places that aren’t us</div>

      <div className="pad hpwrap">
        <p className="hplede">
          Sober Book is a room full of people. Sometimes that isn’t the thing you
          need. Everything on this page belongs to somebody else — we don’t run
          any of it, we aren’t connected to any of it, and nobody pays us to
          list them.
        </p>

        {/* =================================================================
            FIND CARE — the one thing on this page that IS here.

            ⚠️ IT SITS ABOVE THE CRISIS NUMBERS BY A HAIR, AND THAT ORDER WAS
            WEIGHED. Somebody in immediate crisis needs a phone number, not a
            directory — which argues for putting this second. It goes first
            because it is the only item on the page that does not send the
            person out of the app, and because the crisis numbers directly
            below it are unmissable. If that ever stops being true, this moves
            down.

            ⭐ The directory is Dr. Nicole Labor's, which is why this belongs
            on the page of things that aren't us even though it opens in the
            app. She gave RecoveryMap to Sober Book in Sept 2026 and asked for
            it to live inside it.

            🔴 NO REFERRAL TRACKING HERE EITHER — same rule as every outbound
            link on this page, and the database has no `featured` column for
            anybody to buy. See supabase/0167. */}
        <h2 className="hpsec">Somewhere to go</h2>
        <div className="hpcard">
          <h3 className="hpname">Find Care</h3>
          <p className="hpwhat">
            19,490 treatment centres and sober living houses, searchable by state
            and town — the ones that take Medicaid, the ones on a sliding scale,
            and the ones that will treat you while you&rsquo;re on methadone or
            suboxone. Built by <b>Dr. Nicole Labor</b>, an addiction medicine
            doctor in Seville, Ohio, who gave her directory to Sober Book. Nobody
            paid to be on it and nobody can.
          </p>
          <Link className="hptel" href="/find-care">Find care near you</Link>
        </div>

        <h2 className="hpsec">If you need somebody now</h2>
        {NOW.map((r) => (
          <div className="hpcard" key={r.name}>
            <h3 className="hpname">{r.name}</h3>
            <p className="hpwhat">{r.what}</p>
            {/* ⚠️ The number IS the button. Not a link labelled "call" — the
                digits themselves, big enough to hit without aiming. */}
            <a className="hptel" href={`tel:${r.tel}`}>{r.shown}</a>
            {r.href && (
              <a className="hpsite" href={r.href}
                 target="_blank" rel="noreferrer noopener">
                {new URL(r.href).hostname.replace(/^www\./, '')} ↗
              </a>
            )}
          </div>
        ))}

        <h2 className="hpsec">Rooms that aren’t ours</h2>
        {ROOMS.map((r) => (
          <div className="hpcard" key={r.name}>
            <h3 className="hpname">{r.name}</h3>
            <p className="hpwhat">{r.what}</p>
            {/* 🔴 rel="noreferrer" on every one. Elsewhere a referrer is a
                statistic; here it tells a stranger's server logs that the
                visitor came from a recovery app. Same rule as the Wall's
                outbound links (23 Aug).
                ⚠️ And the domain is always shown. In a field where treatment
                centres buy referrals, an unlabelled link is how somebody
                gets sold something. */}
            <a className="hpsite" href={r.href}
               target="_blank" rel="noreferrer noopener">
              {new URL(r.href).hostname.replace(/^www\./, '')} ↗
            </a>
          </div>
        ))}

        <p className="hpfoot">
          None of these organisations are affiliated with Sober Book, and none of
          them have endorsed it. They’re listed because they’re good, and because
          the thing you need at midnight might not be us.
        </p>
      </div>
    </>
  );
}
