/* =====================================================================
   WHICH NAME IS THIS SCREEN WEARING?  13 Nov 2026.

   Ty: "Recovery Belongs is only seen on the beta app… The beta app is
   going to act like the real app… For the website, Sober Book that
   everybody's using right now stays the same."

   ⭐ ONE APP, TWO NAMES. Same members, same wall, same everything. The
   only thing that decides the name is WHERE the page is opened:
     · inside the iPhone app → Recovery Belongs
     · soberbook.app in a browser → Sober Book (unchanged)

   ⚠️ THE SIGNAL is the iPhone app's user agent. capacitor.config.json sets
   ios.appendUserAgent "SoberBookiOS" (see lib/is-ios-app.js). The beta
   build may add its own tag later — list it in IN_APP and both work.

   🔴 Only OUR words change. Anything a member wrote is never touched.
   🔴 Emails, the public profile card and the PO's slip record stay Sober
      Book: they're opened outside the app. "Sober Book LLC" is the legal
      name and stays everywhere.
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
