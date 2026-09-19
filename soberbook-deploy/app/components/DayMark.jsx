'use client';

import { useEffect } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   "OPENED THE APP TODAY." One mark, once a day.  18 Sept 2026.

   The only thing this records is that a signed-in member opened Sober
   Book on a given DATE — see 0176 for why a date and never a time. It
   is what finally lets /admin/growth see the 87% of members who read
   without posting, who were invisible to every other number.

   ⚠️ ONCE PER DAY PER BROWSER, guarded by localStorage, so navigating
   around the app does not hit the database on every page. The guard is
   a convenience, not the rule — the table's primary key is (user, day),
   so a second call the same day writes nothing anyway.

   ⚠️ localStorage can be missing or throw (private windows, blocked
   storage). Every touch is wrapped: if it fails the mark just fires
   again, which is harmless, and nothing on the page ever breaks.

   Renders nothing. Mounted in the root layout, only when signed in.
   ===================================================================== */
const KEY = 'sb-day-mark';

function todayNY() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export default function DayMark({ on = false }) {
  useEffect(() => {
    if (!on) return;
    const day = todayNY();
    try { if (window.localStorage.getItem(KEY) === day) return; } catch { /* storage blocked */ }

    browserClient().rpc('mark_app_day').then(({ error }) => {
      if (error) return;
      try { window.localStorage.setItem(KEY, day); } catch { /* storage blocked */ }
    });
  }, [on]);

  return null;
}
