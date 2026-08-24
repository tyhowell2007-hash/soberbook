/* =====================================================================
   THE MANIFEST — what turns a website into a thing on a home screen.

   Next.js serves this file at /manifest.webmanifest automatically. It's
   a .js file rather than a .json so it can carry comments, which for
   this app is worth more than the two bytes it costs.
   ===================================================================== */

export default function manifest() {
  return {
    name: 'Sober Book',

    /* ⚠️ SHORT NAME IS THE ONE UNDER THE ICON, and phones truncate hard
       — roughly 12 characters before it turns into an ellipsis. "Sober
       Book" fits; anything longer would render as "Sober Bo…" which
       looks broken rather than discreet.

       Ty chose the loud badge knowing the trade (Aug 18). Anyone
       installing on an iPhone can rename this on their own phone before
       they add it — the welcome copy says so. They cannot change the
       picture, which is why the picture was his call and not a default
       I picked quietly. */
    short_name: 'Sober Book',

    description:
      'A place for people in recovery. You never have to explain yourself here.',

    start_url: '/wall',

    /* ⚠️ `standalone`, NOT `fullscreen`. Fullscreen hides the system
       clock and battery, and an app you might be sitting in at 2am
       should not take the clock away from you. It also hides the
       status-bar area people use to orient themselves — disorienting is
       the opposite of what this app is for. */
    display: 'standalone',

    /* Where the app lands if the phone is offline or the URL is bare. */
    scope: '/',

    /* The colour behind the icon on the splash screen, and the one
       Android paints the status bar. --gd, the green room. */
    background_color: '#1B6B4A',
    theme_color: '#1B6B4A',

    orientation: 'portrait',

    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      /* ⚠️ `maskable` is a SEPARATE FILE, not the same image relabelled.
         Android crops icons to whatever shape the launcher uses, and can
         eat the outer 20%. This one has the badge shrunk inside an acid
         field so the crop takes padding instead of the lettering. Point
         both purposes at one file and the words get shaved on a lot of
         phones. */
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png',
        purpose: 'maskable' },
    ],

    categories: ['health', 'lifestyle', 'social'],
  };
}
