'use client';

import { useEffect } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { nativePush, nativeToken, saveNativeToken } from '../../lib/push';
import { safePath } from '../../lib/push-words';

/* =====================================================================
   THE iPHONE APP'S ALERTS — the two things that must happen on every
   launch, not just when somebody taps "Turn it on".  31 Oct 2026.

   1. TAPPING AN ALERT opens the right screen. The payload carries a path
      ("/chat/…", "/p/…/stats/coins"); safePath() refuses anything that
      isn't one, so an alert can never become a link out of the app.

   2. APPLE CAN CHANGE A PHONE'S TOKEN (restore, reinstall, new phone).
      If this person already said yes on this phone, re-register quietly
      and save the current token. ⚠️ Only when the token key is present:
      somebody who turned alerts OFF in the menu must stay off, even
      though iOS still has the permission.

   3. THE RED BUBBLE ON THE ICON (16 Nov 2026). Opening the app — or
      coming back to it — clears it: /api/push/badge sends this member's
      own phones a silent "badge 0". Also clears the stacked alerts in
      Notification Center. At most once every 30 seconds.

   Renders nothing. Does nothing at all outside the iPhone app.
   ===================================================================== */
const CLEAR_GAP_MS = 30 * 1000;
let lastClear = 0;
async function clearBadge(P) {
  if (Date.now() - lastClear < CLEAR_GAP_MS) return;
  lastClear = Date.now();
  try { await P.removeAllDeliveredNotifications(); } catch { /* older plugin */ }
  try { await fetch('/api/push/badge', { method: 'POST', credentials: 'same-origin' }); } catch { /* offline */ }
}
export default function NativePush() {
  useEffect(() => {
    const P = nativePush();
    if (!P) return undefined;
    let handle = null;
    const onVisible = () => { if (document.visibilityState === 'visible') clearBadge(P); };
    document.addEventListener('visibilitychange', onVisible);
    clearBadge(P);

    (async () => {
      try {
        handle = await P.addListener('pushNotificationActionPerformed', (a) => {
          const to = safePath(a?.notification?.data?.to);
          if (window.location.pathname !== to) window.location.assign(to);
        });
      } catch { /* plugin missing in an old build — nothing to do */ }

      try {
        let had = null;
        try { had = localStorage.getItem('sb_apns_token'); } catch { /* private */ }
        if (!had) return;
        const p = await P.checkPermissions();
        if (p.receive !== 'granted') return;
        const token = await nativeToken(P);
        if (token) await saveNativeToken(browserClient(), token);
      } catch { /* never block the app on this */ }
    })();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { handle && handle.remove(); } catch { /* gone */ }
    };
  }, []);

  return null;
}
