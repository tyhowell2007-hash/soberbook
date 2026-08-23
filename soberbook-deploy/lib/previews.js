import { assertReadable } from './supabase-browser';

/* =====================================================================
   THE CONVERSATION, SHOWN ON THE WALL.

   Ty, Aug 23: "lets allow other users to see the replies. it will allow
   others to see the convo and join in."

   Replies were never private — anyone could read them. But you had to TAP
   a number to find out anything was there, so from the wall a post with
   six answers and a post with none looked identical: one line of grey
   text either way. ⭐ Fourth time this month the thing was fully built and
   the way in was hidden (Aug 19 delete-your-post, Aug 20 "Say hi", Aug 23
   sign out, now this). A conversation nobody can see is a conversation
   nobody joins.

   ---------------------------------------------------------------------
   ⭐ WHICH REPLIES, AND WHY IT'S THE LAST ONES.

   Every feed on earth shows "top comments", ranked by likes. That turns
   answering somebody into a competition and buries the person who replied
   quietly at 3am under whoever was funniest.

   Here it's simply the most recent, in the order they were said. Two
   reasons, and the second is the honest one:

     1. The live end of a conversation is where you join it.
     2. THERE IS NOTHING TO RANK BY. Comments have no likes table — not
        disabled, not hidden, absent. So "top comment" isn't a feature we
        turned down; it's a query that cannot be written. Same shape as
        the higher-power wall in 0055.

   ---------------------------------------------------------------------
   ⚠️ ONE IMPLEMENTATION, TWO CALLERS.

   The wall page fetches these on the server for first paint, and Wall.jsx
   re-fetches them in the browser after somebody replies. The obvious build
   is a query in each file — which is how 0046 → 0047 → 0049 happened:
   a rule written twice, then edited once. This takes a supabase client as
   an argument instead, so both callers run the same query by definition.
   ===================================================================== */

/* How many show under a post before it says "see all N". Two is a
   conversation; four is the thread, and the thread already exists one tap
   away. ⚠️ If this ever changes, it changes in one place and both callers
   follow — that's the point of it being here. */
export const PREVIEW_COUNT = 2;

/* ⚠️ A CEILING, BECAUSE THIS QUERY IS OTHERWISE UNBOUNDED. The wall loads
   60 posts and asks for their replies; today that's 16 rows in total, but
   nothing in the query says so. At some size, fetching every reply to
   every post on the page becomes the slowest thing the app does.

   The limit is applied to comments sorted NEWEST FIRST, which is what
   makes it safe rather than arbitrary: what survives the cut is the
   freshly-active conversations, and a post whose last reply was three
   weeks ago simply falls back to showing its count. That's exactly the
   behaviour the whole app had yesterday, so the failure mode is "last
   week's version", not a broken page. */
export const PREVIEW_FETCH_LIMIT = 400;

/* Rows arrive newest-first (that's what the limit needs). A conversation
   reads oldest-to-newest, so each post's slice gets flipped back. */
export function groupPreviews(rows) {
  const by = {};
  for (const r of rows || []) {
    const list = by[r.post_id] || (by[r.post_id] = []);
    if (list.length < PREVIEW_COUNT) list.push(r);
  }
  for (const k of Object.keys(by)) by[k].reverse();
  return by;
}

/* ⚠️ assertReadable('feed_comments') rather than the string, so RULE 1 —
   reads go through the view, never the base table — is enforced here and
   not just remembered. The view is what nulls the author on an anonymous
   reply and, since 0056, what refuses replies on a post you can't see.
   Querying `comments` directly would hand back author_id on every
   anonymous reply on the wall. */
export async function fetchPreviews(supabase, postIds) {
  if (!postIds || !postIds.length) return {};
  const { data, error } = await supabase
    .from(assertReadable('feed_comments'))
    .select('id, post_id, body, created_at, is_anonymous, display_name, is_mine')
    .in('post_id', postIds)
    .order('created_at', { ascending: false })
    .limit(PREVIEW_FETCH_LIMIT);

  /* Swallowed deliberately, same call as signMissing() in Wall.jsx: if
     this fails, every post still shows its reply COUNT and still opens its
     thread. A red error banner across somebody's wall because a preview
     didn't load is a worse page than a wall with no previews. */
  if (error) return {};
  return groupPreviews(data);
}
