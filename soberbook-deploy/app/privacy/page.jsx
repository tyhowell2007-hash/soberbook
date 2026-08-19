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

      <p className="upd">Last updated 18 August 2026</p>

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
      <p>We use two companies to run the app, and no others:</p>
      <ul>
        <li><strong>Supabase</strong> — stores the database and files.</li>
        <li><strong>Vercel</strong> — serves the app itself.</li>
      </ul>
      <p>
        Both are infrastructure providers acting on our instructions. Neither is
        given permission to use anything for their own purposes.
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
      <p className="back"><Link href="/login">← Back</Link></p>
    </div>
  );
}
