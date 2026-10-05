import { notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import { campaign } from '../../../lib/broadcasts';
import Send from './Send';

export const dynamic = 'force-dynamic';

/* =====================================================================
   SENDING A BROADCAST.

   ⭐ WHY THIS PAGE EXISTS RATHER THAN A SCRIPT I RUN. The Resend key
   lives in Vercel's environment. Sending from outside the app means
   putting that key somewhere it can be read — a chat window, a shell
   history, a file. A button inside the app uses the key without anybody
   seeing it, and Ty's own login is the authorisation.

   ⚠️ 404, not "not allowed" — the /admin convention. A polite refusal
   confirms the route is real and worth attacking.

   ⚠️ This check is a convenience over a locked door, not the lock. The
   route behind it does its own owner check, and the database functions
   it calls are revoked from `authenticated` entirely. Delete this file
   and nobody can still send anything.

   🔴🔴 2 SEPT — THIS PAGE SPENT A DAY DESCRIBING THE WRONG EMAIL, AND
   IT IS THE EXACT FAILURE `lib/broadcasts.js` WAS WRITTEN TO PREVENT.
   `Send.jsx` carried `campaign = 'survey'` as a DEFAULT PARAMETER and
   this page rendered a bare `<Send />`. So the buttons operated on the
   survey while every word above them — the heading, the /tour link, and
   a warning about "the only email like this you'll get" — described the
   walkthrough. The counters were honest (0 sent, because the survey had
   sent nobody) and read as alarming under a headline about a campaign
   that had already gone to 151 people.

   ⭐ THE RULE, and the registry already says it in different words: a
   DEFAULT is how the label and the behaviour drift apart. The campaign
   is now NAMED here, on the same screen as the words describing it, so
   changing one without the other is a visible edit rather than an
   invisible one. Send.jsx no longer has a default to fall back on.
   ===================================================================== */

/* ⭐ 2 SEPT — THE HEADING NOW COMES OUT OF THE REGISTRY, not out of this
   file. The bug above was a label and a behaviour drifting apart; naming
   the campaign here fixed half of it, and this fixes the other half —
   `label` is read from lib/broadcasts.js, so the words at the top of a
   section and the email its button sends are the same fact read once.

   ⚠️ ONLY LIVE CAMPAIGNS ARE LISTED. 'tour' (1 Sept) is deliberately
   absent: 151 people have it, the app has since been corrected, and its
   counter would now read "33 to go" with a working button underneath —
   an invitation to send a superseded email to 33 people. A finished
   campaign staying in the registry is history; putting it on screen with
   a button is a loaded gun. */
const LIVE = [
  {
    name: 'survey',
    blurb: <>Links to <Link href="/survey">soberbook.app/survey</Link>. Started 2 Sept.</>,
  },
  {
    name: 'tour2',
    blurb: <>Links to <Link href="/tour">soberbook.app/tour</Link>. Says the film is
      three and a half minutes, because <b>our own page said fourteen</b> for days
      over a 3:29 film.</>,
  },
  /* ⭐ 5 Oct, Ty's call. Thanks first — his brief was warm, thanking
     people for joining and believing in it, and breaking the stigma
     together — then the thing we owed them: replies and messages were
     recorded and almost never passed on.
     ⚠️ It states NO count. 340 unread replies/mentions/messages across
     283 members is 1.2 each, not the "29.6" the prototype claimed — that
     figure counted 12,028 highlight rows from our own past broadcasts.
     ⚠️ And it stays conditional ("if somebody answered you"), because
     134 of the 409 recipients have never been answered by anyone. */
  {
    name: 'replies',
    blurb: <>Thanks for joining, then the notifications gap. Links to{' '}
      <Link href="/notifications">soberbook.app/notifications</Link>. <b>No number in
      it</b> &mdash; most people have one reply waiting, not a pile.</>,
  },
];

export default async function SendPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  return (
    <div className="pad">
      <h1>Broadcasts</h1>
      <p className="hint">
        Everybody who has email switched on. Nobody can get the same one twice
        &mdash; the database refuses it.
      </p>

      {LIVE.map(({ name, blurb }) => {
        const c = campaign(name);
        /* ⚠️ A name that isn't in the registry renders a refusal instead of
           a send button. The route would refuse it too; this just means the
           failure is visible up here rather than after a press. */
        if (!c) {
          return (
            <section key={name}>
              <h2>{name}</h2>
              <p className="err">No campaign called &ldquo;{name}&rdquo;. Nothing can be sent.</p>
            </section>
          );
        }
        return (
          <section key={name} style={{ margin: '28px 0 0' }}>
            <h2>{c.label}</h2>
            <p className="hint">{blurb}</p>
            <Send campaign={name} />
          </section>
        );
      })}

      {/* 🔴 THIS PARAGRAPH USED TO SAY THE SURVEY WAS "THE LAST BROADCAST
          DOWN THIS PIPE" and that a third would make two sentences a lie.
          A third is now on this page, at Ty's direction, so leaving that
          claim up would have made the admin screen itself dishonest —
          which is the same failure as the survey heading describing the
          walkthrough, one level up.

          ⚠️ It is replaced rather than deleted, because the promise it
          was protecting is real and still owed to 151 people. */}
      {/* 🔴 UPDATED 5 Oct, BECAUSE A FOURTH IS NOW ON THIS PAGE. Leaving
          the old wording up would make this screen say "this one breaks it
          twice" above four buttons — the same dishonesty as the survey
          heading describing the walkthrough, one level up. The promise it
          protects is still real and still owed, so it is rewritten rather
          than removed. */}
      <p className="hint" style={{ marginTop: 32 }}>
        The 1 Sept walkthrough email said it was <b>the only one like it</b>{' '}
        anybody would get. The survey broke that once and said so. The
        walkthrough re-run broke it twice and said so. <b>This is the
        fourth</b>, and it says so too. Its reason is not a feature: people
        were being answered here and never told, and the thanks was overdue.
        <b> Every further broadcast spends credibility we are running low
        on.</b> The next one needs a better reason than a good idea &mdash;
        and after four, better than this one had.
      </p>
    </div>
  );
}
