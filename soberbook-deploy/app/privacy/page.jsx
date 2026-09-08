import Link from 'next/link';

/* =====================================================================
   THE PRIVACY POLICY.

   ⚠️ WRITTEN FROM THE SCHEMA, NOT FROM A TEMPLATE. Every claim below was
   checked against the actual columns in the database on Aug 18. A
   privacy policy that overstates is worse than none — it is a promise
   in writing that the code doesn't keep, and for this app the promise
   IS the product.

   ⚠️ IT IS ALSO PUBLIC ON PURPOSE. Both app stores require a policy at
   a URL reachable without an account, and it would be absurd to hide
   the document explaining what we collect behind a sign-up form. See
   middleware.js — /privacy is on the open list.

   ⚠️ NOT LEGAL ADVICE AND NOT LAWYER-DRAFTED. Ty should have a real
   one read this before it carries weight anywhere that matters. It is
   honest and specific, which is the part a lawyer cannot supply.
   ===================================================================== */

export const metadata = {
  title: 'Privacy — Sober Book',
  description: 'What Sober Book collects, what it never collects, and how to leave.',
};

export default function Privacy() {
  return (
    <div className="legal">
      <h1>Privacy</h1>
      <p className="lead">
        Short version: we collect the least we can get away with, we don&apos;t
        sell any of it, there are no ads and no trackers, and you can delete
        everything yourself at any time.
      </p>

      <p className="upd">Last updated 7 September 2026</p>

      <h2>What we store</h2>
      <p>Only what you type in, plus what the app needs to work:</p>
      <ul>
        <li><strong>Your email address</strong> — to sign you in and reset your
          password. It is never shown to another member. Ever.</li>
        <li><strong>Your handle</strong>, and a display name and picture if you
          add them.</li>
        <li><strong>Your sober date</strong>, if you enter one, and whatever you
          choose to fill in — a line about yourself, your town, your programs,
          what you&apos;re into, whether you&apos;re sponsoring.</li>
        <li><strong>What you post</strong> — your words, and any photo or video
          you attach.</li>
        <li><strong>Your messages</strong> to other members.</li>
        <li><strong>Housekeeping</strong> — who you&apos;ve blocked, what
          you&apos;ve reported, which posts you liked, when you last read a
          thread.</li>
      </ul>

      <h2>What we never collect</h2>
      <ul>
        <li><strong>Your location.</strong> The app never asks for it, and if a
          photo or video you upload has GPS coordinates buried inside it, our
          server strips them out before the file is stored anywhere. The
          original is destroyed.</li>
        <li><strong>Your contacts, your calendar, your other apps.</strong></li>
        <li><strong>Anything from advertisers or analytics companies.</strong>
          There are no third-party trackers in this app. Not one.</li>
      </ul>

      <h2>Who can see what</h2>
      <p>
        Posts and profiles are visible to other signed-in members. Nothing here
        is public on the open internet, and search engines are asked not to
        index it.
      </p>
      <p>
        <strong>Anonymous posts are anonymous to everyone, including us in
        practice.</strong> The name on an anonymous post is a one-way code. Even
        a moderator reviewing a reported anonymous post is not shown who wrote
        it — the tool they use has no column for it.
      </p>
      <p>
        Your day count can be hidden. Your town is hidden by default. If you set
        yourself as looking for a sponsor, only members with a year or more can
        see that.
      </p>

      {/* ⭐ ADDED 7 SEPT, THE DAY SAGE WAS BUILT AND BEFORE IT WENT LIVE.
          Not after. The page below promises that a change that matters
          gets announced rather than quietly edited in, and shipping the
          feature first would have made this document false for however
          long the gap was — which is the /tour bug exactly: a truthful
          email, then a product that contradicted it. */}
      <h2>Sage</h2>
      <p>
        Sage is a computer program that can answer questions about how this
        app works. It is not a person, it is not a member, and it will never
        appear here wearing a name and a face as though it were one.
        Wherever you see it, it says what it is.
      </p>
      <p><strong>What it is shown:</strong></p>
      <ul>
        <li>A question you type into the help page.</li>
      </ul>
      <p><strong>What it is never shown, and cannot be:</strong></p>
      <ul>
        <li><strong>Your messages to other members.</strong> Not one, not ever.</li>
        <li><strong>The reason you write when you pledge.</strong> That text is
          not shown to another member, to a friend, or to us — there is no way
          to ask the database for it, and Sage is not getting one.</li>
        <li>Your email, your handle, your sober date, or anything you have
          hidden on your profile. We send your question and nothing else, so
          the company that runs it could not identify who asked even if they
          wanted to.</li>
      </ul>
      <p>
        That company is Anthropic. Their commercial terms say plainly that they
        may not train models on what we send them, and we read that ourselves
        rather than taking anybody&apos;s word for it. Nothing you ask Sage is
        stored on our side either — there is no transcript of it anywhere, the
        same way there is no record of you doing the breathing exercise.
      </p>
      <p>
        <strong>Sage does not handle an emergency.</strong> If something you
        write reads like you are in danger, it does not try to talk you through
        it — you get the 988 line and a way to real people. It is not a
        counsellor, a doctor or a sponsor, and it is not a substitute for one.
      </p>

      <h2>We do not sell your information</h2>
      <p>
        Not to advertisers, not to insurers, not to treatment providers, not to
        anyone. There is no arrangement under which your data leaves this app in
        exchange for money, and there never will be — it would destroy the only
        reason this place works.
      </p>

      <h2>Leaving</h2>
      <p>
        Go to <strong>You → the pencil → Account → Delete your account</strong>.
        It removes your account, your posts, your replies, your messages, your
        photos and videos, and nobody can sign in as you again.
      </p>
      <p>
        You&apos;ll be asked one question first: whether to also delete anything
        you posted <em>anonymously</em>. Those have no name on them and other
        people may have replied underneath, so it&apos;s your call, not ours.
      </p>

      <h2>Who we share with</h2>
      {/* 🔴 THIS SENTENCE WENT FROM TWO TO THREE ON 7 SEPT AND IT IS THE
          ONLY LINE IN THE WHOLE POLICY THAT SAGE BROKE. Everything else
          about it survived intact — including "no third-party trackers",
          which is still true: a model we hand a question to on purpose is
          not a tracker. The fix was a new section and one number, not a
          softened old claim. */}
      <p>We use three companies to run the app, and no others:</p>
      <ul>
        <li><strong>Supabase</strong> — stores the database and files.</li>
        <li><strong>Vercel</strong> — serves the app itself.</li>
        <li><strong>Anthropic</strong> — answers the questions you ask Sage,
          and only those. See above for what it is and is not shown.</li>
      </ul>
      {/* 🔴 THIS SAID "BOTH" FOR AN HOUR AFTER THE LIST BECAME THREE, and it
          was caught by reading the LIVE page rather than the diff. Two
          companies went to three above and the sentence underneath was left
          alone — so the promise that nobody may use your data for their own
          purposes silently excluded the one company members would most want
          it to cover. A count in prose is a second copy of the list above
          it, and the second copy is the one that drifts. */}
      <p>
        All three act only on our instructions. None of them is given
        permission to use anything for their own purposes.
      </p>

      <h2>Young people</h2>
      <p>Sober Book is for people 18 and over.</p>

      <h2>Asking us something</h2>
      <p>
        Write to <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>.
        A real person reads it.
      </p>

      <hr />
      <p className="fine">
        If this policy ever changes in a way that matters, the app will say so
        rather than quietly updating this page.
      </p>
      {/* ⚠️ Added 8 Sept with /rules. This page says what we do with what you
          write; /rules says what you can write. They are the two halves of the
          same question and a stranger deciding whether to sign up will want
          both — /privacy is reachable from the front door, so it is also the
          cheapest place to make the rules findable without an account. */}
      <p className="fine">
        What we ask of each other in here is a separate page:{' '}
        <Link href="/rules">the rules</Link>. Deleting your account is{' '}
        <Link href="/delete-account">here</Link>.
      </p>
      <p className="back"><Link href="/login">← Back</Link></p>
    </div>
  );
}
