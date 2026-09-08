import Link from 'next/link';

/* =====================================================================
   THE RULES — the community guidelines page.

   🔴 WHY IT EXISTS, AND THE SMALLER REASON IS THE BETTER ONE.

   The big reason: Apple's Guideline 1.2 (User-Generated Content) asks
   for four things before a social app ships — a way to filter
   objectionable content, a way to report it, a way to block a user, and
   PUBLISHED contact details plus the rules. On 8 Sept Sober Book had
   three of four, built back in August. This was the missing one, and it
   is the single most common rejection reason for social apps.

   ⭐ The better reason: the report sheet has had a "breaks the rules"
   lane since 0023, pointing at rules that had never been written down
   anywhere. A member reporting something was being asked to judge
   against a standard nobody had published. That was true for six weeks
   and no amount of Apple would have made it less true.

   ⚠️ EVERY CLAIM HERE WAS READ OUT OF THE SCHEMA ON 8 SEPT, not written
   from a template. Same rule as the privacy policy and the deletion
   page: this page is a promise, and a promise the code doesn't keep is
   worse than no page.

     · reports.kind is CHECK ('rules','concern')   → the two lanes named
     · reports.target_type is CHECK ('post','comment','profile',
       'message','room_message')                   → "every ⋯ in the app"
     · report_queue has NO author_id column        → moderation without
       unmasking is structural, not a policy. SAY IT THAT WAY.
     · blocks: my_blocks() + unblock_member()      → the undo is real
     · an ignored/blocked person is NEVER told     → 0045's rule

   🔴 RULE 3 IS TY'S CALL, MADE 8 SEPT, AND IT REVERSED MINE. I drafted a
   hard ban on any promotion. He said: "The treatment center ads are
   there to help people. There for people to contact them. But if they
   want to promote their stuff, they're allowed to." He is right that a
   card on the wall carrying a phone number is a service, not a pitch —
   somebody looking for a bed should be able to find one.

   ⚠️ SO THE RULE BANS A DIRECTION, NOT A SUBJECT. Promotion is fine;
   reaching INTO a stranger's inbox is not. That keeps the one protection
   that actually matters — patient brokering works by contacting the
   person at their worst moment, not by advertising — without banning the
   org cards Ty has been building since 26 Aug.

   ⚠️ THE PAGE MUST HAVE A WAY IN, or it is the fourteenth "everything
   built except the way in" in six weeks. As shipped it is linked from:

     · the report sheet's rules lane in ALL FOUR ⋯ menus — PostMenu,
       ReplyMenu, MsgMenu, RowMenu. That is the one that matters: the
       person who wants the rules is the person filing a report.
     · /privacy, which a stranger can reach from the front door

   🔴 NOT from /me, and that is a real gap, not an oversight I am hiding.
   Me.jsx is 96KB and gets edited by diff; adding a link there belongs in
   its own commit rather than riding along with eight other files. Task
   #341. If a future edit removes the links above, this page may as well
   not exist.

   ⚠️ IT IS ON THE OPEN LIST IN middleware.js. Apple and Google both need
   to reach it WITHOUT an account, exactly like /delete-account. Test it
   signed out or don't test it.
   ===================================================================== */

export const metadata = {
  title: 'The rules here — Sober Book',
  description:
    'The rules for Sober Book: what this place is for, what gets an account removed, how to report and block, and what we cannot do.',
};

export default function Rules() {
  return (
    <div className="legal">
      <h1>The rules here</h1>

      <p className="lead">
        Sober Book has one promise: you never have to explain yourself.
        Everything below exists to keep that true for the next person.
      </p>

      <p className="upd">Sober Book · soberbook.app · last updated 8 September 2026</p>

      <h2>The short version</h2>
      <p>
        Don&apos;t out anybody. Don&apos;t pitch to anybody who didn&apos;t ask.
        Don&apos;t prescribe. Don&apos;t hit on people who just got here.
      </p>

      <h2>Who this is for</h2>
      <p>
        People in recovery, however you&apos;re doing it. AA, NA, SMART, church,
        therapy, Suboxone, methadone, naltrexone, a dog and a running habit, or
        nothing with a name yet. All paths welcome, medication included. Nobody
        here has to defend their route.
      </p>
      <p>You have to be 18 or over to have an account.</p>

      <h2>The rules</h2>

      <h3>1. What happens here stays here</h3>
      <p>
        Don&apos;t screenshot, repost or forward what somebody wrote — not to
        Facebook, not to a group chat, not to somebody who&apos;d find it funny.
        Don&apos;t name anyone you recognise from a meeting.
      </p>

      <h3>2. Anonymous means anonymous</h3>
      <p>
        If somebody posted without their name on it, don&apos;t guess out loud
        who they are, and don&apos;t confirm somebody else&apos;s guess. Not even
        in a message. Working out who somebody is and saying so is the one thing
        this whole app is built to prevent.
      </p>

      <h3>3. Say who you are before you sell anything</h3>
      <p>
        Treatment centres, sober livings, peer supporters and programs are
        welcome here, and you can talk about what you offer. Somebody looking for
        a bed should be able to find one.
      </p>
      <p>Two conditions, and they aren&apos;t negotiable:</p>
      <ul>
        <li>
          <strong>Say plainly who you work for.</strong> No pretending to be a
          member who just happens to recommend a place.
        </li>
        <li>
          <strong>Let people come to you.</strong> Don&apos;t send a pitch to
          somebody who didn&apos;t ask, and never to somebody who has just posted
          that they&apos;re struggling. That is the version of this that has hurt
          people in this industry, and it will cost you your account here.
        </li>
      </ul>
      <p>No MLM, no crypto, no make-money-from-home.</p>

      <h3>4. Nobody prescribes</h3>
      <p>
        Don&apos;t tell somebody to come off their medication. Don&apos;t tell
        them their sobriety doesn&apos;t count. You are not their doctor and you
        don&apos;t know their history.
      </p>

      <h3>5. Don&apos;t use this place to find someone vulnerable</h3>
      <p>
        Don&apos;t hit on people who just got here. A day count is not a dating
        filter. If you&apos;re not sure whether a message is friendly or
        something else, it&apos;s something else.
      </p>

      <h3>6. Don&apos;t kick somebody who fell</h3>
      <p>
        A relapse posted here is somebody coming back. Answer it, or scroll past
        it.
      </p>

      <h3>7. No supply talk</h3>
      <p>
        Say what happened to you. Don&apos;t post amounts, doses, methods, or
        where to get anything.
      </p>

      <h3>8. No hate</h3>
      <p>
        Race, religion, who somebody is, who they love, how they got here. No.
      </p>

      <h2>What happens when somebody breaks one</h2>
      <p>
        Every post, reply, profile, message and room message has a{' '}
        <strong>⋯</strong>. Tap it and choose <strong>Report</strong>.
      </p>
      <p>
        It goes to a queue only the person who runs Sober Book can see, and it is
        read by a human, not a filter. Depending on what it is, the content comes
        down, the account is suspended, or both. There is no strike counter —
        rule 3 or rule 5 can end an account the first time.
      </p>
      <p>
        <strong>A report never unmasks anybody.</strong> The queue is built so an
        anonymous post can be read and acted on without ever showing who wrote
        it. That is not a policy we promise to follow — the name is not in there
        to look at.
      </p>

      <h2>Block — you don&apos;t owe anyone a reason</h2>
      <p>
        <strong>Block</strong> is on that same <strong>⋯</strong>, and on
        anybody&apos;s profile. It is instant, it works both ways, and the other
        person is never told — they simply stop being able to reach you. You can
        undo it any time from your own page.
      </p>
      <p>
        You don&apos;t have to report somebody to block them, and you don&apos;t
        have to have a reason.
      </p>

      <h2>If you&apos;re worried about somebody</h2>
      <p>
        The report menu has a second lane: <strong>I&apos;m concerned about
        them</strong>. It isn&apos;t a punishment button — it flags that somebody
        might be in danger, and it shows the 988 Suicide &amp; Crisis Lifeline on
        the way through.
      </p>
      <p>If something scares you, use it. Then, if you can, answer them.</p>

      <h2>What we can&apos;t do, said plainly</h2>
      <p>
        We don&apos;t verify that anybody is who they say they are. Nobody here
        is vetted or background-checked, and any app that tells you otherwise is
        lying to you. Treat people the way you&apos;d treat a stranger at your
        first meeting — warmly, and with your own judgement switched on.
      </p>

      <hr />

      <p className="fine">
        Questions, or something you don&apos;t think we got right:{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>. A real
        person reads it. What we collect and what we don&apos;t is set out in the{' '}
        <Link href="/privacy">privacy policy</Link>, and{' '}
        <Link href="/delete-account">deleting your account</Link> takes one tap
        from your own page.
      </p>
    </div>
  );
}
