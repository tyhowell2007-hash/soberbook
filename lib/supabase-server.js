import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/* Server-side client. Imports next/headers, so this file must NEVER be
   imported from a 'use client' component — see lib/supabase-browser.js. */
export function serverClient() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // called from a Server Component — middleware refreshes the session
          }
        },
      },
    }
  );
}

export { assertReadable, READABLE_VIEWS } from './supabase-browser';
