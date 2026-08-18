import { createClient } from '@supabase/supabase-js';

/* =====================================================================
   THE SERVICE ROLE CLIENT — the only thing that may touch the buckets.

   ⚠️ NEVER import this from a file with 'use client' at the top, and
   never from a component. It reads SUPABASE_SERVICE_ROLE_KEY, which
   bypasses RLS on every table in the database. Shipped to a browser it
   would hand every member's entire record to anyone who opened
   devtools.

   The name is the guard rail: there is no NEXT_PUBLIC_ prefix, so Next
   refuses to inline it into client bundles even by accident. That's why
   the variable is named the way it is rather than something tidier.

   WHY THIS EXISTS AT ALL, given the app has managed without it for two
   weeks: 0022 gave the buckets no client policies whatsoever. The
   browser cannot read or write a byte of storage. Something has to be
   able to, and it must be code we control, running where a person can't
   edit it — because the whole point is that the location-stripping step
   is not optional.
   ===================================================================== */
let cached = null;

/* Is the key present at all?

   ⚠️ THIS EXISTS SO THE WALL CANNOT BE TAKEN DOWN BY A MISSING SETTING.

   Signing photo links needs the service role. The Wall renders on the
   server, so if adminClient() throws while the key is unset, the throw
   happens during render and the ENTIRE WALL 500s — no posts, no
   composer, nothing — because one optional feature isn't configured.

   That is a catastrophic failure mode for a cosmetic dependency, and it
   is exactly the kind of thing that gets discovered by a member at 2am
   rather than by me. So reads ask first and degrade to "no photos"; only
   the upload route, where the key is genuinely required to do the job,
   is allowed to fail loudly. */
export function adminConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminClient() {
  if (cached) return cached;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    /* Fail loudly and early. The alternative — a client that half works
       — produces a 500 somewhere deep in an upload with a message about
       JWTs that tells nobody anything. */
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Photos cannot be uploaded ' +
      'or displayed until it is added to the environment.'
    );
  }

  cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
