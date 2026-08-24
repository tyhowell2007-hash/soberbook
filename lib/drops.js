import { assertReadable } from './supabase-browser';

/* =====================================================================
   THE RECORDS ON A PAGE OF POSTS.

   🔴 WHY THIS EXISTS: the poster didn't appear until a full reload.

   Ty put out his first record and said "it seemed like it was gonna work,
   but it never showed up on the home feed." It HAD worked — the post row
   and the drop row were both there. But `drops` was a prop handed down by
   the server, and the only thing that refreshed it was router.refresh(),
   which races with the client re-reading `posts`. So the post appeared
   instantly, carrying no poster, and the poster arrived some time later
   or not at all.

   ⭐ The previews had exactly this shape solved already (lib/previews.js).
   This is the same fix: one function, taking a supabase client, called by
   the server for first paint and by the browser after anything changes —
   so the two can't drift.

   ⚠️ Read through feed_drops, NEVER the drops table. The view is what
   returns media_path as NULL before release and withholds the outbound
   link during an exclusive window. Reading the base table would hand an
   unreleased master's file path to every browser on the wall.
   ===================================================================== */

const COLUMNS =
  'post_id, artist, title, kind, art_path, release_at, exclusive_hours, ' +
  'is_out, is_exclusive_now, exclusive_until, external_url, media_path';

export async function fetchDrops(supabase, postIds) {
  if (!postIds || !postIds.length) return {};
  const { data, error } = await supabase
    .from(assertReadable('feed_drops'))
    .select(COLUMNS)
    .in('post_id', postIds);

  /* Swallowed on purpose, same call as fetchPreviews: if this fails the
     post is still there with its words and its replies. A red banner
     across somebody's wall because a poster didn't load is a worse page
     than a wall with no poster. */
  if (error) return {};
  return Object.fromEntries((data || []).map((d) => [d.post_id, d]));
}

/* The storage paths a set of drops needs signed. ⚠️ media_path is already
   NULL here for anything unreleased — the view removed it — so an
   unreleased track physically cannot end up in this list. */
export function dropPaths(map) {
  return Object.values(map || {})
    .flatMap((d) => [d.media_path, d.art_path])
    .filter(Boolean);
}
