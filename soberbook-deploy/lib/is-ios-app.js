/* =====================================================================
   AM I RUNNING INSIDE THE iPHONE APP?  15 Sept 2026.

   🔴 WHY THIS EXISTS, AND IT IS NOT A PREFERENCE — IT IS APPLE'S RULE.
   Guideline 3.1.1, verbatim: "apps must use in-app purchase for
   donations, including those which are merely to tip the developers."
   Approved nonprofits may fundraise in-app with Apple Pay. Sober Book
   LLC is for-profit, so it may not. The "Buy us a coffee" button is a
   donation link to Buy Me a Coffee, and on iOS it is a guaranteed
   rejection — not a judgement call like Guideline 4.2.

   ⭐ So the button is hidden ONLY inside the iPhone app. The web and
   Android keep it exactly as it is, and Apple takes no cut of anything,
   because nothing is being sold through the app.

   ⚠️ THE SIGNAL COMES FROM capacitor.config.json — `ios.appendUserAgent`
   is set to "SoberBookiOS", which Capacitor appends to the WKWebView's
   user agent. If that config line is ever removed, this returns false
   everywhere and the button comes back on iOS. The two are one feature;
   they live apart only because one is an app config and one is web code.

   ⚠️ ONE IMPLEMENTATION, called from both surfaces (the landing page and
   /me). This schema has been bitten four times by restating a rule in a
   second place and watching the copy drift — 0046 → 0047 → 0049, and the
   renamed field in 0083. A three-line function is still a rule.
   ===================================================================== */

export function isIosApp() {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('SoberBookiOS');
}
