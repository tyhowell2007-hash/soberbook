/* =====================================================================
   WHICH NAME IS THIS SCREEN WEARING?  13 Nov 2026.

   Ty: "Recovery Belongs is only seen on the beta app… The beta app is
   going to act like the real app… For the website, Sober Book that
   everybody's using right now stays the same."

   ⭐ ONE APP, TWO NAMES. Same members, same wall, same everything. The
   only thing that decides the name is WHERE the page is opened:
     · inside the iPhone app (TestFlight, the beta) → Recovery Belongs
     · soberbook.app in a browser → Sober Book (unchanged)

   ⚠️ THE SIGNAL is the iPhone app's user agent: "SoberBookiOS" (every
   TestFlight build) or "RecoveryBelongs" (Build 5 onward adds it).
   ⭐ Ty, 13 Nov, 11 pm: the TestFlight app IS the beta, so it says
   Recovery Belongs for everyone in it, Ty included. soberbook.app in a
   browser (what members use today) stays Sober Book.
   ===================================================================== */

export const BRANDS = {
  sb: { key: 'sb', name: 'Sober Book', icon: '/icon-192.png' },
  rb: { key: 'rb', name: 'Recovery Belongs', icon: '/rb-icon-192.png' },
};

const IN_APP = ['SoberBookiOS', 'RecoveryBelongs'];

export function brandFromUA(ua) {
  return ua && IN_APP.some((t) => ua.includes(t)) ? BRANDS.rb : BRANDS.sb;
}

/* For plain functions (not components) that run in the browser. On the
   server it answers Sober Book — server code uses serverBrand() instead. */
export function brandNow() {
  if (typeof navigator === 'undefined') return BRANDS.sb;
  return brandFromUA(navigator.userAgent);
}
