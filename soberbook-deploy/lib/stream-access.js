/* =====================================================================
   MAY THIS PERSON WATCH THIS VIDEO?

   ⭐ This file contains NO permission rules, and that is the point. It is
   the same shape as lib/sign-photos.js: the caller's OWN session queries
   the views, the views already know about anonymity, blocks, suspension,
   deleted rooms, declined threads and post audience — and only what comes
   back is vouched for.

   Written the other way — "is the author a friend, unless blocked, unless
   anonymous…" — it becomes a second copy of rules that already exist, and
   in this schema the second copy is the one that drifts (0046 → 0047 →
   0049, three times). Ask. Do not decide.

   🔴 THE VIEWS MUST RETURN stream_uid OR THIS ALWAYS SAYS NO (0145). That
   is the safe direction to fail — a video that will not play is a bug you
   hear about; a video that plays to the wrong person is not.

   ⚠️ `supabase` here is the MEMBER's client, never adminClient(). Handing
   this the service role would make every check pass.
   ===================================================================== */

const SHAPE = /^[a-f0-9]{32}$/;

export async function mayWatch(supabase, uid) {
  /* Refuse a malformed id before spending four queries on it. The same
     CHECK constraint guards the columns (0144), so anything failing here
     could never have been stored by us in the first place. */
  if (typeof uid !== 'string' || !SHAPE.test(uid)) return false;

  /* ⚠️ Four separate asks rather than one clever join, because each view
     answers for a different surface and they have nothing in common but
     the column name. `.limit(1)` because we want a yes/no, not a list —
     and because a moderator hitting report_queue should not pull the
     whole queue to answer one question. */
  const asks = [
    supabase.from('feed_posts').select('stream_uid').eq('stream_uid', uid).limit(1),
    supabase.from('room_wall').select('stream_uid').eq('stream_uid', uid).limit(1),
    supabase.from('chat_messages').select('stream_uid').eq('stream_uid', uid).limit(1),
    /* 🔴 report_queue is gated on is_moderator() inside the view itself,
       so for a normal member this simply returns nothing. It is here so a
       moderator can watch a video that has been reported and then DELETED
       from the surface it was on — which is exactly when they most need
       to see it. */
    supabase.from('report_queue').select('stream_uid').eq('stream_uid', uid).limit(1),
  ];

  const results = await Promise.all(asks);
  /* ⚠️ An ERROR is not a yes. A missing grant, a renamed column or a view
     that failed to replace all arrive here as `error` with `data` null,
     and treating that as "no row, therefore refuse" is the only safe
     reading. */
  return results.some((r) => !r.error && Array.isArray(r.data) && r.data.length > 0);
}
