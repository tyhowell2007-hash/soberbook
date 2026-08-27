import { assertReadable } from './supabase-browser';

/* =====================================================================
   WHO IS TAGGED ON A PAGE OF POSTS (0067).

   ⭐ Same shape as lib/previews.js and lib/drops.js, deliberately: ONE
   function taking a supabase client, called by the server for first paint
   and by the browser after anything changes. Written twice, the two
   copies drift — and drops proved that expensively, when a member's new
   record didn't appear until a full reload because the server had it and
   the client didn't.

   ⚠️ Read through post_tags, NEVER post_mentions. The view is what drops
   a tag somebody has removed from themselves, hides tags on posts you
   cannot see, and refuses to return anything at all for an anonymous
   post. The base table knows none of that.
   ===================================================================== */

export async function fetchTags(supabase, postIds) {
  if (!postIds || !postIds.length) return {};
  const { data, error } = await supabase
    .from(assertReadable('post_tags'))
    .select('post_id, handle, display_name, is_me')
    .in('post_id', postIds);

  /* Swallowed on purpose, same call as previews and drops: if this fails
     the post is still there with its words, its pictures and its replies.
     A red banner across somebody's wall because a name didn't load is a
     worse page than a wall with no names on it. */
  if (error) return {};

  const out = {};
  for (const t of data || []) {
    (out[t.post_id] = out[t.post_id] || []).push(t);
  }
  /* ⚠️ Sorted by handle, not by when the tag was made. Tag order is not
     a ranking and should not read like one — "who got mentioned first"
     is a thing people notice and nobody should have to think about. */
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.handle.localeCompare(b.handle));
  }
  return out;
}

/* Attaching tags to a post that was just created.

   ⚠️ Inserted one at a time rather than as a batch, and failures are
   collected instead of thrown. If somebody tags three friends and one of
   those friendships was severed a second ago — a block, say — a batch
   insert refuses ALL THREE and the person loses the whole post. The
   database is the authority on who may be tagged (mentions_guard), so
   the honest client behaviour is: try each, report which didn't land,
   keep the post.

   🔴 The post is already saved by the time this runs. Nothing here can
   lose it. */
export async function attachTags(supabase, postId, handles) {
  const wanted = [...new Set((handles || []).filter(Boolean))];
  if (!wanted.length) return { added: [], refused: [] };

  /* handle -> id, through the view members are allowed to read. */
  const { data: people } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle')
    .in('handle', wanted);

  const known = new Set((people || []).map((p) => p.handle));

  const added = [];
  const refused = [];
  for (const h of wanted) {
    if (!known.has(h)) { refused.push(h); continue; }
    const { error } = await supabase.rpc('tag_friend', { p_post: postId, p_handle: h });
    if (error) refused.push(h); else added.push(h);
  }
  return { added, refused };
}
