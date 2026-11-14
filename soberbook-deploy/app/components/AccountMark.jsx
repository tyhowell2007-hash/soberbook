'use client';

import { useEffect } from 'react';

/* =====================================================================
   0203, 13 Nov 2026 — SPOTTING BANNED PEOPLE COMING BACK.
   Once a day per browser, tells /api/mark "this account is on this
   device". The server hands it to record_account_mark(), which turns the
   device id and connection into scrambled codes (salted SHA-256) and
   only ever compares them with SUSPENDED accounts, or within the hour for
   a burst of new sign-ups. Kept 90 days. The privacy page says so.

   ⭐ Ty's call: sign-up is unchanged and nobody is ever stopped. This
   only lets Ty and Kenny find out; a flag asks a person to look.

   The device id is a random code made here and kept in this browser's
   storage. It is not a fingerprint of the phone and holds nothing about
   the person. Storage blocked → no device code, nothing breaks.
   Renders nothing. Mounted in the root layout, only when signed in.
   ===================================================================== */
const DEV = 'sb-dev';
const DAY = 'sb-mark-day';

function deviceId() {
  try {
    let d = window.localStorage.getItem(DEV);
    if (!d) {
      d = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
      window.localStorage.setItem(DEV, d);
    }
    return d;
  } catch { return ''; }
}

export default function AccountMark({ on = false }) {
  useEffect(() => {
    if (!on) return;
    const day = new Date().toISOString().slice(0, 10);
    try { if (window.localStorage.getItem(DAY) === day) return; } catch { /* storage blocked */ }
    fetch('/api/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ d: deviceId() }),
    }).then((r) => {
      if (r.ok) { try { window.localStorage.setItem(DAY, day); } catch { /* storage blocked */ } }
    }).catch(() => {});
  }, [on]);
  return null;
}
