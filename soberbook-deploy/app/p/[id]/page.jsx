import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import Open from './Open';

export const dynamic = 'force-dynamic';

/* =====================================================================
   A POST, AT ITS OWN ADDRESS.  31 Aug.

   Ty asked for the notification bell to work "like Facebook does it" —
   and the one thing Facebook gets right that we didn't is that tapping a
   notification takes you TO THE THING.

   Until now the bell could tell you Kenny answered your post and then
   strand you: there was no per-post route, so the row wasn't a link. That
   is the trap from 20 Aug written down in the bell's own source — "a link
   that loads the right page but does the wrong thing is worse than a
   broken one" — and the honest fix was never a better link, it was this
   page.

   ⭐ TWELFTH "EVERYTHING BUILT EXCEPT THE WAY IN". The thread view, the
   composer, the anonymous reply, the alias — all shipped weeks ago. Only
   the URL was missing.

   ---------------------------------------------------------------------
   ⚠️ THE READ GOES THROUGH feed_posts, NEVER `posts`.

   `authenticated` has no SELECT on `posts` at all, because that table
   carries author_id on anonymous rows. It is also the reason this page
   cannot simply .single() the base table, and the reason it doesn't need
   to re-implement one word of the audience rule: feed_posts already asks
   post_visible(), already nulls an anonymous author, and already drops
   posts by somebody who has blocked you.

   🔴 SO A MISSING ROW MEANS ONE OF FOUR THINGS — deleted, friends-only
   and you aren't, blocked either way, or suspended — AND THIS PAGE MUST
   NOT SAY WHICH. Distinguishing "deleted" from "not yours to see" tells
   a stranger that a specific post exists and is being kept from them,
   which is exactly what the audience rule exists to prevent. One vague
   sentence for all four.
   ===================================================================== */

export default async function PostPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* ⚠️ maybeSingle(), not single(). single() THROWS on zero rows, and a
     post you can't see is the normal case here, not an exception — a
     notification for a post whose author later blocked you is an ordinary
     Tuesday. single() would turn that into a 500 on the page somebody
     opened because they were told somebody cared. */
  const { data: post } = await supabase
    .from(assertReadable('feed_posts'))
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!post) {
    return (
      <div className="pad">
        <div className="mast">
          <Link href="/wall" className="back" aria-label="Back">‹</Link>
          <span className="lg cvname">Not here</span>
        </div>
        {/* One sentence for all four reasons. See the header. */}
        <p className="ntfempty">
          This post isn’t here any more, or it isn’t one you can see.
        </p>
        <p className="ntfempty">
          <Link href="/wall" className="btn">Back to the wall</Link>
        </p>
      </div>
    );
  }

  return <Open post={post} />;
}
