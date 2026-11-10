'use client';

import { browserClient } from './supabase-browser';

/* =====================================================================
   tap(what) — log that a member tapped a button.  9 Nov 2026 (Kenny).

   Feeds the insights dashboard: which Home doors, say-it tabs, New here
   card and craving tools get used. Writes one row to public.ui_taps
   (supabase/ui_taps.sql): who, a short button name, when. Never text.

   ⚠️ FIRE AND FORGET. It is never awaited and it can never throw: a
   failed log must not cost a member a tap. If the table doesn't exist
   yet, or the network drops, the insert just fails quietly.
   ⚠️ Names are lowercase_with_underscores; the table refuses anything
   else, so a typo here shows up as missing data, not as junk data.
   ===================================================================== */
export function tap(what) {
  try {
    browserClient().from('ui_taps').insert({ what }).then(() => {}, () => {});
  } catch { /* never block the tap */ }
}
