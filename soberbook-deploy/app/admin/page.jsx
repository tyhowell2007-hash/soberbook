import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../lib/supabase-admin';
import Queue from './Queue';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE MODERATION QUEUE.

   PostMenu has been promising members "Ty reviews reports himself,
   usually the same day" since Aug 6, and until now there was no screen on
   which he could see one. This is that screen.

   ---------------------------------------------------------------------
   ⚠️ notFound(), NOT "you are not allowed"

   A non-moderator gets a 404 — the same page a typo gets. The obvious
   alternative is a polite "you don't have access", and it quietly
   confirms that /admin is real and worth attacking. There is no reason
   for anyone but Ty to learn this route exists.

   The 404 is cosmetic, though, and worth being honest about: the actual
   enforcement is `where is_moderator()` inside the view and the same
   check repeated inside all three action functions. If this page were
   deleted entirely the rules would still hold. That's the right order —
   the page is a convenience over a locked door, not the lock.
   ===================================================================== */
export default async function AdminPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* The view returns zero rows to a non-moderator rather than erroring,
     so "is he allowed" and "what's in the queue" are the same question
     asked once. But zero rows is also what an EMPTY queue looks like, and
     those two must not be confused — hence the separate check below. */
  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  const { data: rows } = await supabase
    .from('report_queue')
    .select('*')
    .order('status', { ascending: true })      // open first
    .order('created_at', { ascending: false });

  /* Signed with the service role rather than through signPhotoPaths().
     ⚠️ Deliberate, and the reason is subtle: signPhotoPaths asks
     feed_posts, which hides posts by anyone the viewer has blocked. A
     moderator who blocked somebody would then be unable to see the very
     photo they'd been asked to judge — the queue would show a report
     about an invisible picture. Authorisation here was already settled by
     is_moderator() on the view. */
  const urls = {};
  if (adminConfigured()) {
    /* 🔴 EVERY reported photo, not the first (0065). A moderator deciding
       whether to suspend somebody over a ten-photo post, while looking at
       one of them, is deciding on a tenth of the evidence — and the one
       they were shown is the one the poster chose to lead with. */
    const paths = [...new Set((rows || []).flatMap((r) => [
      ...(Array.isArray(r.photo_urls) ? r.photo_urls : []), r.photo_url,
    ]).filter(Boolean))];
    /* 🔴 THE BUCKET COMES FROM THE PATH, NOT FROM A CONSTANT. This line
       used to say `from('post-photos')` full stop, which was right while
       every reportable photo lived on a post. A picture in The Front Room
       (0093/0095) is in `room-photos`, so it would have come back with no
       signed URL — and a missing URL renders as a broken image, not as an
       error. The moderator would have been asked to judge a photo they
       could not see, with nothing anywhere saying why.

       ⚠️ Same rule as lib/sign-photos.js: the stored value is
       self-describing and the prefix IS the routing. Nothing here names a
       bucket that the path didn't already choose. */
    for (const [bucket, prefix] of [['post-photos', 'posts/'],
                                    ['room-photos', 'rooms/']]) {
      const mine = paths.filter((p) => p.startsWith(prefix));
      if (!mine.length) continue;
      const { data } = await adminClient()
        .storage.from(bucket).createSignedUrls(mine, 3600);
      (data || []).forEach((r) => { if (r.signedUrl) urls[r.path] = r.signedUrl; });
    }
  }

  return <Queue rows={rows || []} urls={urls} />;
}
