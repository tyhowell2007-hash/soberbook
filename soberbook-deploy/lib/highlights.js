/* ⚠️ No assertReadable import here, unlike lib/tags.js. That guard is for
   reading a VIEW, and this file deliberately never reads a table or a
   view — it calls an RPC, for the reason set out below. Importing it
   anyway would suggest a table read had been considered and allowed. */

/* =====================================================================
   WHICH POSTS ON THIS PAGE ACTUALLY ANNOUNCED THEMSELVES (0139).

   ⭐ Same shape as lib/tags.js, lib/previews.js and lib/drops.js, and
   deliberately so: ONE function taking a supabase client, called by the
   server for first paint and by the browser after anything changes.
   Written twice, the two copies drift — drops proved that expensively
   when a member's new record didn't appear until a full reload because
   the server had it and the client didn't.

   ---------------------------------------------------------------------
   🔴 WHY THIS ASKS THE DATABASE AT ALL, WHEN THE WORD IS RIGHT THERE.

   The cheap build is: body contains "@highlight" → draw the pill. That
   is a guess wearing the costume of a fact, and it is already wrong on
   live data. Nine posts on the wall contain the word. EIGHT of them
   broadcast. One never did.

   So the cheap build puts a badge reading "this went to everybody" on a
   post that went to nobody. That is the same failure as the drop card
   that said "Sober Book first" over a song already released, and the
   landing page that promised "verified, real people". The whole value
   of a confirmation is that it can be believed.

   ⚠️ lib/mentions.js exports saysHighlight() for the OTHER question —
   did somebody ASK for a broadcast. That one is about intent and is the
   right test in the composer. This one is about what happened. Do not
   substitute one for the other; they disagree on real posts.

   ---------------------------------------------------------------------
   ⚠️ IT IS AN RPC, NOT A TABLE READ, AND THAT IS NOT A STYLE CHOICE.

   Members hold no grant on `notifications` — 0080 revoked it because
   that table carries actor_id, which unmasks the author of an anonymous
   mention. posts_that_broadcast() is SECURITY DEFINER and returns post
   ids and nothing else: no actor, no recipients, no count.
   ===================================================================== */

/* 🔴 RETURNS A PLAIN ARRAY, AND IT MUST.

   The natural shape for "is this one in it" is a Set, and the first
   version of this file returned one. That would have broken first paint:
   this is fetched in app/wall/page.jsx — a SERVER component — and handed
   to Wall.jsx as a prop, and React cannot serialise a Set across that
   boundary. Arrays and plain objects survive; Sets, Maps and Dates do
   not.

   ⚠️ It fails at RUNTIME, and the build is green, which is the same
   shape as the server component importing a named export from a client
   module that took /wall down for fifteen minutes on 2 Sept. Caught here
   by asking what crosses the boundary rather than by watching it break.

   The caller builds the Set. At most 60 posts a page, so that costs
   nothing. */
export async function fetchBroadcasts(supabase, postIds) {
  if (!postIds || !postIds.length) return [];

  const { data, error } = await supabase
    .rpc('posts_that_broadcast', { p_ids: postIds });

  /* Swallowed on purpose, the same call previews, drops and tags all
     make: if this fails the post is still there with its words, its
     pictures and its replies. A missing pill is a missing decoration.
     A red banner across somebody's wall because a decoration didn't
     load is a worse page than a wall with no pills on it.

     ⚠️ FAILING CLOSED IS THE RIGHT DIRECTION HERE and it is worth
     saying why: an empty set means nothing is confirmed, so the wall
     stays silent. The opposite default would announce that every post
     saying the word had reached 209 people, which is exactly the lie
     this file exists to prevent. */
  if (error) return [];

  /* ⚠️ A set-returning function comes back either as bare strings or as
     rows keyed by the function name, depending on how PostgREST decides
     to shape it. Handling both is not defensiveness for its own sake —
     guessing wrong here produces a list of `undefined`, which fails the
     "is this one in it" test silently and shows no pill anywhere. */
  return (data || [])
    .map((r) => (typeof r === 'string' ? r : r?.posts_that_broadcast ?? r?.id))
    .filter(Boolean);
}
