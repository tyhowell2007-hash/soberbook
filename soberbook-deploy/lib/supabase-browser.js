import { createBrowserClient } from '@supabase/ssr';

/* Browser-side client only.

   ⚠️ Kept in its own file on purpose. An earlier version put the browser
   and server clients together, which meant any 'use client' component
   importing it also pulled in `next/headers` — server-only — and the build
   failed. Splitting them is the fix, and it also means a client component
   can never accidentally reach for a server helper. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/* =====================================================================
   RULE 1, IN CODE.

   Nothing in this app may select from `posts`, `comments`, or `profiles`
   directly — anonymous rows would carry author_id. Reads go through the
   views, which null it out and compute is_mine instead.

   The database also revokes SELECT on those tables, so a direct query
   fails rather than silently leaking. This exists so the rule is visible
   at the call site too.
   ===================================================================== */
/* chat_threads and chat_messages joined the list on Aug 16. Same reason,
   sharper: `messages` holds private conversations, and the database now
   revokes SELECT on it entirely. The views are the only read path, and
   they are where "you ignored this person" and "this person blocked you"
   get filtered out before anything reaches a browser. */
export const READABLE_VIEWS = [
  'feed_posts', 'feed_comments', 'public_profiles',
  'chat_threads', 'chat_messages',
  /* meeting_attendance — who else is going to a meeting. Reading
     meeting_going directly would hand back raw member_id uuids for
     people who have blocked you; the view joins through public_profiles
     so blocking, suspension and anonymity are inherited. See 0021. */
  'meeting_attendance',
  /* feed_drops — a member's record (0058). Safe for the same reason as
     the rest: it never exposes a base table, and it is what returns
     media_path as NULL before release. Reading `drops` directly would
     hand every unreleased master's file path to any signed-in member. */
  'feed_drops',
  /* post_tags — who is tagged on a post (0067). Safe for the same reason
     as the rest: it never exposes a base table. Reading post_mentions
     directly would hand back tags somebody has REMOVED from themselves,
     and tags on posts the reader cannot see — the view drops both, and
     asks post_visible() rather than restating the audience rule. */
  'post_tags',
  /* open_meeting_rooms — meetings members are holding here (0052).
     Safe to read for the same reason meeting_attendance is: it never
     exposes a base table. It joins profiles itself and hands back a
     handle, a display name and an INTEGER count of who's inside — never
     the member ids of the people in the room. Reading meeting_rooms or
     room_presence directly would hand back raw uuids, including for
     somebody who has blocked you. See 0052. */
  'open_meeting_rooms',
  /* what_gets_you_through — the wall of higher powers (0055). Safe for
     the same reason as the two above: it never exposes a base table.
     Reading higher_powers directly would hand back author_id for every
     ANONYMOUS answer on the page, which on that page is the whole point
     of the feature — somebody who was thrown out of a church, or who
     doesn't believe and is surrounded by people who do, saying so
     without signing it. The view nulls the id, swaps in an alias, and
     drops the day count. See 0055. */
  'what_gets_you_through',
];

export function assertReadable(name) {
  if (!READABLE_VIEWS.includes(name)) {
    throw new Error(
      `Refusing to read "${name}" directly. Anonymous posts leak author_id ` +
      `from base tables. Use one of: ${READABLE_VIEWS.join(', ')}. ` +
      `See README → The two rules.`
    );
  }
  return name;
}
