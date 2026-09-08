import Link from 'next/link';

/* =====================================================================
   DELETING YOUR ACCOUNT — the public page.

   🔴 WHY THIS EXISTS AS A PAGE AT ALL. Google Play's Data safety form
   requires a deletion URL that anyone can open WITHOUT the app and
   WITHOUT an account. On 8 Sept that URL was entered into the form as
   https://soberbook.app/delete-account before this file existed. A
   reviewer opening it and getting a 404 is a rejection, so this page is
   a promise being kept, not a nice-to-have.

   ⚠️ IT MUST BE ON THE OPEN LIST IN middleware.js. Without that line a
   signed-out visitor is redirected to /login — which is precisely the
   failure this page exists to prevent, and it would look like it works
   to anyone testing while signed in. The two ship together.

   ⚠️ WRITTEN FROM THE CODE, NOT FROM A TEMPLATE. Every claim below was
   read out of app/api/account/delete/route.js and the delete_my_account
   function in the database on 8 Sept. Same rule as the privacy policy:
   a deletion page that overstates is a promise in writing the code does
   not keep.

   🔴 THE ONE THING THAT IS EASY TO GET WRONG: "keep my anonymous posts"
   does NOT delete the profile row. It strips it to an unnamed stub and
   sets deleted_at. That is a retained record and it is named as one
   below. The login and the email address are destroyed in BOTH modes.
   ===================================================================== */

export const metadata = {
  title: 'Delete your account — Sober Book',
  description:
    'How to delete your Sober Book account and everything in it, what gets removed, and what does not.',
};

export default function DeleteAccount() {
  return (
    <div className="legal">
      <h1>Deleting your account</h1>

      <p className="lead">
        You can delete your Sober Book account yourself, from inside the app,
        at any time. It happens straight away — there is no waiting period and
        nobody has to approve it.
      </p>

      <p className="upd">Sober Book · soberbook.app · last updated 8 September 2026</p>

      <h2>From inside the app</h2>
      <p>
        Go to <strong>You</strong> → the <strong>pencil</strong> →{' '}
        <strong>🔑 Account</strong> → <strong>Delete your account</strong>.
      </p>
      <p>
        You will be asked to type your own handle to confirm. That is
        deliberate — it is the one action in the app with no undo, and a
        checkbox is muscle memory by the third tap.
      </p>

      <h2>If you can&apos;t get in</h2>
      <p>
        If you have lost your password or can&apos;t reach your account, email{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a> from the
        address you signed up with and ask us to delete it. A real person reads
        that inbox. We will delete the account and reply to confirm.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your login and your email address</li>
        <li>Your handle, display name, photo and everything on your profile</li>
        <li>Your sober date, your lifetime total, your pledges and your check-ins</li>
        <li>Your posts and your replies</li>
        <li>Your messages, and the conversations they were in</li>
        <li>Your photos, videos and any music you posted — the files themselves, not just the links</li>
        <li>Your likes, your notifications, and anyone you had blocked</li>
      </ul>
      <p>
        Nobody can sign in as you afterwards, and your handle is retired rather
        than released — so an old link to your profile can never later point at
        a stranger.
      </p>

      <h2>The one question you&apos;ll be asked</h2>
      <p>
        Before it runs, you get one choice: whether to also delete the things
        you posted <em>anonymously</em>.
      </p>
      <p>
        Those carry no name, and other people may have replied underneath them.
        Deleting them takes those conversations away from the people still in
        them, so it is your call and not ours. The default is that everything
        goes.
      </p>

      <h2>What is kept, and only in one case</h2>
      <p>
        If you choose <strong>delete everything</strong> — the default — nothing
        is kept. The account row itself is removed.
      </p>
      <p>
        If you choose to <strong>keep your anonymous posts</strong>, one thing
        survives: an empty placeholder that those posts hang from. It holds no
        name, no email, no sober date, no photo and nothing you wrote about
        yourself — all of that is erased. It exists only so the anonymous posts
        you chose to leave behind don&apos;t break. Your login and your email
        address are destroyed in this case too.
      </p>
      <p className="fine">
        Supabase, who host the database, take automatic backups of the whole
        system. A copy of deleted data can survive in those backups until they
        expire on their own. We cannot reach into a backup to remove one
        person, and we never restore one to recover a deleted account.
      </p>

      <hr />

      <p className="fine">
        Questions about any of this:{' '}
        <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>. What we
        collect in the first place is set out in the{' '}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    </div>
  );
}
