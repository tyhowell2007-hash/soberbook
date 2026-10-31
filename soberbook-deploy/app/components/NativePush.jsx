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

   Renders nothing. Does nothing at all outside the iPhone app.
   ===================================================================== */
export default function NativePush() {
  useEffect(() => {
    const P = nativePush();
    if (!P) return undefined;
    let handle = null;

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

    return () => { try { handle && handle.remove(); } catch { /* gone */ } };
  }, []);

  return null;
}
