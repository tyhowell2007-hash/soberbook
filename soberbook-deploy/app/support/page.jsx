import Link from 'next/link';

/* =====================================================================
   SUPPORT — the public page.

   🔴 WHY THIS EXISTS. Both stores require a Support URL: a page anyone
   can open WITHOUT the app and WITHOUT an account, that tells a person
   how to get help from a human. Apple checks it. Until this file
   existed the answer we would have had to give was /rules, which is a
   code of conduct and answers nothing a stuck person is asking.

   ⚠️ IT MUST BE ON THE OPEN LIST IN middleware.js. Without that line a
   signed-out visitor — which is every reviewer and every person locked
   out of their account — gets redirected to /login. That is precisely
   the dead end this page exists to prevent, and it would LOOK fine to
   anyone testing it while signed in. Same trap as 17 Aug, third time.
   The two ship together.

   🔴 DO NOT LINK /help FROM HERE. /help is a genuinely good page and it
   is NOT on the open list — a signed-out visitor following that link is
   bounced to a password box. So the two numbers that matter are printed
   on this page directly, as tel: links, rather than pointed at.

   ⚠️ NO RESPONSE-TIME PROMISE. There is no support team and no rota. A
   page that says "within 24 hours" is a promise one person cannot keep
   at 3am, and a missed promise is worse than no promise. It says who
   reads the inbox instead, which is both true and more reassuring.

   ⚠️ hello@soberbook.app IS THE ONLY ADDRESS THAT WORKS. Porkbun has no
   catch-all — support@, info@ and help@ go nowhere and DO NOT BOUNCE,
   so a person writing to a guessed address gets silence and concludes
   nobody is there. Never print another one on this page.
   ===================================================================== */

export const metadata = {
  title: 'Support — Sober Book',
  description:
    'How to get help with Sober Book: signing in, your account, reporting someone, and who to call if you need somebody right now.',
};

export default function Support() {
  return (
    <div className="legal">
      <h1>Support</h1>

      <p className="lead">
        Something not working, or somebody bothering you? Write to{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>. A real
        person reads that inbox — not a queue, not a bot.
      </p>

      <p className="upd">Sober Book · soberbook.app · last updated 15 September 2026</p>

      <h2>If you need somebody right now</h2>
      <p>
        This comes first because it is the only thing on this page that
        can&apos;t wait for an email.
      </p>
      <ul>
        <li>
          <strong>988</strong> — Suicide &amp; Crisis Lifeline. Call or text,
          any hour. <a href="tel:988">Tap to call 988</a>.
        </li>
        <li>
          <strong>1-800-662-4357</strong> — SAMHSA&apos;s national helpline.
          Free, confidential, 24/7, treatment referrals.{' '}
          <a href="tel:+18006624357">Tap to call</a>.
        </li>
      </ul>
      <p className="fine">
        Neither of those is us. We don&apos;t run them, we aren&apos;t connected
        to them, and nobody pays us to list them. Inside the app there is a
        longer page of places like this, with more numbers on it.
      </p>

      <h2>I can&apos;t sign in</h2>
      <p>
        On the sign-in page, tap <strong>I forgot my password</strong> and put
        in the email address you signed up with. A link arrives by email; open
        it on the same device and it drops you straight onto a page where you
        set a new password.
      </p>
      <p>
        The link only works once, and only for about an hour. If you get{' '}
        <em>&quot;that link&apos;s gone stale&quot;</em>, ask for a fresh one —
        that is the link expiring, not your account being gone.
      </p>
      <p>
        If the email never turns up, check spam first, then write to{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a> from the
        address you signed up with and say so. We can see whether the email was
        sent and we will get you back in.
      </p>

      <h2>Somebody is bothering me</h2>
      <p>
        You can block or report anybody, from anywhere you can see them. Look
        for the <strong>⋯</strong> — it is on every post, every reply, every
        row in Community, every profile page and inside every conversation.
      </p>
      <p>
        <strong>Block</strong> is immediate and it cuts both directions: they
        can&apos;t message you, reply to you, or see your posts, and you
        won&apos;t see theirs. <strong>Report</strong> sends it to us with the
        message or post attached.
      </p>
      <p>
        If it is urgent, or if it is something you would rather not put in a
        report form, email{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a> and say
        what happened. What is and isn&apos;t allowed is set out in{' '}
        <Link href="/rules">the rules</Link>.
      </p>

      <h2>Something in the app is broken</h2>
      <p>
        Tell us and it usually gets fixed the same night. The three things that
        make it fast:
      </p>
      <ul>
        <li>Which screen you were on</li>
        <li>What you tapped, and what happened instead</li>
        <li>A screenshot, if you can — it is worth ten paragraphs</li>
      </ul>
      <p>
        Nearly everything we have fixed since August was found by somebody
        using the app and saying so, not by us looking. It is not a bother.
      </p>

      <h2>Changing or deleting your account</h2>
      <p>
        Your handle, your display name, your photo, your sober date and who can
        see what are all editable under <strong>You</strong> → the{' '}
        <strong>pencil</strong>.
      </p>
      <p>
        You can delete your account and everything in it yourself, at any time,
        with no waiting period and nobody to ask.{' '}
        <Link href="/delete-account">How to delete your account</Link> sets out
        exactly what goes and what — in one case — stays.
      </p>

      <h2>What Sober Book is not</h2>
      <p>
        It is a place to talk to other people in recovery. It is{' '}
        <strong>not</strong> a treatment provider, not a crisis service, and
        nothing in it is medical advice. Nobody here is verified or vetted, and
        we don&apos;t claim otherwise.
      </p>
      <p>
        Nobody pays us to be listed, we take no referral fees from treatment
        centres, and there are no ads. If that ever changes it will be said out
        loud, on this page, before it happens.
      </p>

      <hr />

      <p className="fine">
        <Link href="/rules">The rules</Link> ·{' '}
        <Link href="/privacy">Privacy policy</Link> ·{' '}
        <Link href="/delete-account">Delete your account</Link>
      </p>
      <p className="fine">
        Sober Book LLC · Cadiz, Ohio ·{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>
      </p>
    </div>
  );
}
