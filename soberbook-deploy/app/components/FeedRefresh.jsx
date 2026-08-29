'use client';

import { useEffect } from 'react';

/* =====================================================================
   KEEP THE CONTENT FEED FRESH WITHOUT DEPENDING ON THE CRON.

   🔴 WHY THIS EXISTS. The Vercel cron pointed at /api/content/cron has
   now missed two days running. Everything about it is configured
   correctly — the schedule is `0 11 * * *`, vercel.json is in
   soberbook-deploy where Vercel reads it, the job shows as Enabled, the
   middleware exempts the path, and hitting the route by hand works
   perfectly (14 items on 29 Aug, zero errors). It simply doesn't fire.

   ⭐ AND VERCEL'S OWN DOCS SAY TO STOP TRYING TO FIX THAT. On Hobby, a
   failed cron invocation is NEVER retried, and the failure log is gone
   after an hour — so a skipped run leaves no evidence at all. Their
   written guidance is that cron jobs must "be resilient to both missed
   runs and duplicate runs". This is that resilience.

   The cron is now a bonus. The feed staying fresh no longer depends on it.

   ---------------------------------------------------------------------
   ⭐ WHY IT'S SAFE TO LET A MEMBER'S BROWSER TRIGGER THIS.

   /api/content/cron is already a public, unauthenticated URL — that was
   a deliberate call when it was written, because it is RATE-LIMITED BY
   ITS OWN DATA: if any source was pulled in the last 6 hours it refuses
   and says so. The worst anyone can do by calling it is make it answer
   "not yet". So this adds no exposure that didn't already exist; it just
   means the thing that calls it is a real visitor instead of a scheduler
   that doesn't show up.

   🔴 The moment that route gains a side effect that isn't idempotent —
   deleting, emailing, charging — this component has to go and the route
   needs real auth. Same warning that's written at the top of the route.

   ---------------------------------------------------------------------
   ⚠️ WHY THERE IS NO LOCK, AND WHY THAT'S CORRECT.

   Several members opening the wall at once could each fire a refresh
   before any of them finishes. That looked like it needed a claim table
   until I read the schema: `content_items` has a UNIQUE index on
   (source_id, external_id). A second concurrent pull inserts nothing —
   every row collides. The uniqueness rule was already there, so the
   concurrency problem was already solved and adding a lock would have
   been a second copy of a rule that exists.

   ⚠️ It fires once per tab, guarded by sessionStorage, so normal reading
   and navigating around the app doesn't ping it repeatedly. The 6h guard
   in the route is the real protection; this is just manners.

   ⚠️ AND IT NEVER THROWS, NEVER AWAITS, AND RENDERS NOTHING. The wall
   must not get slower — or break — because a podcast feed is stale. Same
   reasoning as RegisterSW: whatever this costs, it costs after the page
   is usable, and a failure is silent because the member did not ask for
   this and cannot act on it.
   ===================================================================== */

const ONCE_KEY = 'sb-feed-ping';

export default function FeedRefresh() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    /* Once per tab. sessionStorage rather than localStorage on purpose:
       a device that's left open for days should still check again on the
       next fresh visit, and the route's own 6h rule stops that being a
       problem. ⚠️ Wrapped because private-mode browsers can throw on
       access, and this feature is not worth an exception. */
    try {
      if (sessionStorage.getItem(ONCE_KEY)) return;
      sessionStorage.setItem(ONCE_KEY, '1');
    } catch { /* no session storage — fall through and ping once */ }

    const go = () => {
      /* keepalive so a member who taps away immediately doesn't cancel a
         pull that's already begun. The response is deliberately ignored:
         there is nothing useful to tell them either way. */
      fetch('/api/content/cron', { cache: 'no-store', keepalive: true })
        .catch(() => {});
    };

    /* After load, never during it. The wall is what they came for. */
    if (document.readyState === 'complete') {
      const t = setTimeout(go, 1500);
      return () => clearTimeout(t);
    }
    const onLoad = () => setTimeout(go, 1500);
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
