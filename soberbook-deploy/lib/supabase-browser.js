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
