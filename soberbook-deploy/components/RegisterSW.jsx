'use client';

import { useEffect } from 'react';

/* =====================================================================
   TURN THE SERVICE WORKER ON.

   ⚠️ IT REGISTERS AFTER `load`, NOT IMMEDIATELY. Registering during
   startup makes the browser fetch and parse sw.js while it's still
   drawing the first screen, on the same connection. On a good phone
   that's invisible; on a bad one it's the wall taking longer to appear
   in exchange for a benefit nobody sees until their SECOND visit.
   Whatever it costs, it should cost after the page is usable.

   ⚠️ AND IT NEVER THROWS. A failed registration is silent on purpose —
   the app works perfectly without it. Somebody in a private window, or
   on a browser that blocks workers, must not see an error about a
   feature they didn't ask for. `.catch(() => {})` is doing real work
   here, not hiding a bug.
   ===================================================================== */

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const go = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };

    if (document.readyState === 'complete') go();
    else {
      window.addEventListener('load', go, { once: true });
      return () => window.removeEventListener('load', go);
    }
  }, []);

  return null;
}
