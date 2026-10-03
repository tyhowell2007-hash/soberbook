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
/* 🔴 3 Oct 2026 — A MILESTONE CELEBRATION LEAVES THE WALL AFTER 24 HOURS.
   Before this there was no limit of any kind. pickCelebrations takes the three
   newest milestone posts regardless of age and there have only ever been four,
   so three celebrations sat pinned to the top of every wall for a MONTH — one
   of them reading "90 days today." six days after the day, and a "30 days
   today!" seventeen days after it. The post was never wrong; its permanence was.

   ⚠️ THE POST IS NOT DELETED AND NOT EDITED. It is excluded from the two wall
   queries below, and from nothing else:
     · /me still shows the member their own milestone (app/me/page.jsx reads
       feed_posts filtered by is_mine and does not come through here).
     · The permalink still opens, with every reply on it, because Thread.jsx
       fetches the post by id and does not come through here either. The four
       existing milestones carry 27 replies and 138 reactions between them and
       none of that is lost — it just stops living on the wall.
     · /friends' milestone list is built from profiles, not posts. Untouched.

   ⚠️ BOTH QUERIES NEED THE BOUND, NOT ONE. `recent` would carry a stale
   milestone back in while it is inside the newest-60 window; `milestones`
   exists precisely to float one from OUTSIDE that window, so on its own it
   would keep an old celebration pinned forever. Cut one and the bug survives
   in the other. */
export const CELEBRATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function fetchFeedPosts(supabase, table = 'feed_posts', itemIds = null) {
  const ids = Array.isArray(itemIds) ? itemIds.filter(Boolean).slice(0, 300) : null;
  const freshFrom = new Date(Date.now() - CELEBRATION_WINDOW_MS).toISOString();
  const [recent, milestones, ads] = await Promise.all([
    supabase.from(table).select('*')
      .is('content_item_id', null)
      /* not a milestone, OR a milestone from the last 24h */
      .or(`milestone_days.is.null,created_at.gte.${freshFrom}`)
      .order('created_at', { ascending: false }).limit(FEED_WINDOW),
    supabase.from(table).select('*')
      .not('milestone_days', 'is', null)
      .gte('created_at', freshFrom)
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
