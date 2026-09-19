/* ============================================================================
   WHAT THE WALL IS MADE OF — fetched in ONE place, for server and browser.

   🔴 THIS FILE EXISTS BECAUSE THE RULE WAS WRITTEN FOUR TIMES AND FIXED ONCE.
   On 16 Sept `app/wall/page.jsx` was taught to fetch milestone posts and ad
   posts in their own queries, so that a celebration or an advert could not
   silently fall off the bottom of the newest-60 window. Wall.jsx re-fetches
   the same list in THREE places — after a reply, after answering the
   milestone ask, and after posting — and every one of them was still a plain
   `limit(60)`.

   ⭐ SO THE FIX LASTED UNTIL THE FIRST CLIENT REFRESH. Measured on the live
   wall: seven ads rendered as posts on the server pass, then two after the
   browser re-fetched, with five falling back to bare cards that cannot be
   hearted or replied to. The milestone cards go the same way — the moment
   somebody replies to anything, a celebration older than sixty posts drops
   out of the array and the card it should have floated simply is not there.

   ⭐ THE LESSON, AND THIS PROJECT HAS NOW LEARNED IT FIVE TIMES (0046 → 0047
   → 0049, the milestone label, and here): a claim that a rule is written
   once has to be CHECKED against every file that implements it. `grep -n
   "feed_posts" app/wall/Wall.jsx` returns three lines. The 16 Sept work
   touched none of them.

   ⚠️ A function two runtimes both need belongs to NEITHER of them — no
   'use client' here, same as lib/previews.js, lib/drops.js and
   lib/open-room.js. Putting it in Wall.jsx would mean the server could never
   call it again (2 Sept, a named import from a client module took /wall down
   for every member with a green build).
   ============================================================================ */

import { MAX_CELEBRATIONS } from './mix';

export const FEED_WINDOW = 60;

/* Ads are few and hand-placed, so this only has to be larger than the number
   of pinned items that will ever exist at once. It is not a display cap —
   lib/mix.js decides how many are shown and where. */
export const AD_FETCH = 120;

/* ⚠️ Dedupe by id, keeping the order the lists arrive in. A milestone or an
   ad inside the last sixty comes back from two queries, and rendering
   somebody's medal — or an advert — twice on one screen is worse than not
   floating it at all. */
function merge(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const p of list || []) {
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

/* Takes the client as an argument so the server and the browser run the SAME
   query by definition rather than by somebody remembering to keep two copies
   in step. `assertReadable` is applied by the caller on the server, where the
   rule about reading through views is enforced. */
/* 🔴 19 Sept (0179) — PODCAST EPISODES AND EVERY AD ARE POSTS NOW, so
   they can be hearted and replied to. Two consequences, both handled here:
   1. The "newest 60" window must NOT count them. They are dated to the
      episode, and ten new episodes would otherwise push ten members' posts
      off the wall. `content_item_id is null` on the recent query.
   2. There are hundreds of them, so "the newest 40" no longer finds the
      ones on screen. Pass `itemIds` (the cards actually being shown) and
      exactly those posts are fetched; without it, the newest AD_FETCH. */
export async function fetchFeedPosts(supabase, table = 'feed_posts', itemIds = null) {
  const ids = Array.isArray(itemIds) ? itemIds.filter(Boolean).slice(0, 300) : null;
  const [recent, milestones, ads] = await Promise.all([
    supabase.from(table).select('*')
      .is('content_item_id', null)
      .order('created_at', { ascending: false }).limit(FEED_WINDOW),
    supabase.from(table).select('*')
      .not('milestone_days', 'is', null)
      .order('created_at', { ascending: false }).limit(MAX_CELEBRATIONS),
    ids && ids.length
      ? supabase.from(table).select('*').in('content_item_id', ids)
      : supabase.from(table).select('*')
          .not('content_item_id', 'is', null)
          .order('created_at', { ascending: false }).limit(AD_FETCH),
  ]);

  return {
    /* ⚠️ Only the first query's error is surfaced, deliberately. If the
       celebrations or the ads fail the wall should still be a wall — the
       same stance as signPhotoPaths degrading to no-photos rather than
       500ing the page. Losing a card must never mean losing the feed. */
    error: recent.error || null,
    posts: merge(recent.data, milestones.data, ads.data),
  };
}
