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
export const READABLE_VIEWS = ['feed_posts', 'feed_comments', 'public_profiles'];

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
