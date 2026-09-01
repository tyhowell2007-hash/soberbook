import './globals.css';
import './wall.css';

/* ⚠️ theme-green.css IS DELIBERATELY NOT IMPORTED HERE. DO NOT ADD IT BACK.

   Ty's call, Aug 15 evening: "The only grunge part is when they sign in
   in the beginning. The rest of it is supposed to look different."

   Grunge is the DOOR. Green is the ROOM. This file is the root layout, so
   anything imported here paints both — including /login and /reset, which
   are supposed to stay black-and-acid. theme-green restyles .mast and .bar,
   and those are on the sign-in screen too, so importing it here turns the
   door green and destroys the whole contrast.

   Instead each room imports it for itself:
     app/wall/layout.jsx · app/me/layout.jsx
     app/welcome/layout.jsx · app/u/layout.jsx

   Those four files are the entire green theme. Delete them and the app is
   grunge again, intact — theme-green.css and every rule under it is a pure
   override layer that touches no markup and no logic. */

import RegisterSW from './components/RegisterSW';
/* ⚠️ IN THE ROOT LAYOUT ON PURPOSE, unlike theme-green.css above. It has
   to see the FIRST tap anybody makes, and for most people that tap is on
   the sign-in screen — several screens before they ever reach a profile.
   Mounting it under /u would be too late to be worth having. It renders
   nothing and paints nothing, so it doesn't touch the door/room split. */
import AudioUnlock from './components/AudioUnlock';

export const metadata = {
  title: 'Sober Book',
  description: 'You never have to explain yourself here.',

  /* Next.js finds app/manifest.js on its own and links it from here. */
  manifest: '/manifest.webmanifest',

  appleWebApp: {
    /* iOS reads this instead of the manifest — Safari has never
       supported `display: standalone` from a web manifest, so without
       these three lines an iPhone install still opens inside Safari
       with the address bar showing, which is exactly the thing people
       install an app to get away from. */
    capable: true,
    title: 'Sober Book',
    /* 'default' keeps the black-on-white status bar. Not
       'black-translucent' — that draws the page UNDER the clock and
       battery, and the masthead would sit behind them. */
    statusBarStyle: 'default',
  },

  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },

  /* ⚠️ Stops iOS turning day counts and phone-like numbers into blue
     tappable "call" links. On a page whose main feature is a big number,
     that misfires constantly and looks broken. */
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#1B6B4A',
  width: 'device-width',
  initialScale: 1,
  /* ⚠️ NOT `maximumScale: 1` and NOT `userScalable: false`. Locking zoom
     is the standard trick for making a web app feel native and it takes
     pinch-to-zoom away from anyone who needs it to read. A recovery app
     is used by people of every age, at 2am, in bad light. Native feel is
     not worth somebody not being able to read the words. */
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          /* Fraunces and Space Grotesk are the warm door (app/door.css).
             They're declared here with the rest because this is one CSS
             request either way — a browser only downloads the woff2 for a
             family a page actually uses, so the grunge pages don't pay for
             the serif and the warm door doesn't pay for Anton.

             ---------------------------------------------------------------
             ⭐ ARCHIVO IS DELIBERATELY ABSENT — 31 Aug, Ty's call after we
             looked at what Facebook actually does.

             Facebook uses THREE typefaces, and two of them are proprietary
             (Facebook Sans for the wordmark, Optimistic for the wider Meta
             brand — both Dalton Maag, neither available). The third is the
             one that matters: **the entire feed is set in the reader's own
             system font.** San Francisco on iPhone, Roboto on Android,
             Segoe UI on Windows. That is why it reads as an app rather than
             a website on a phone.

             ⭐ THE FIX EDITED NO CSS AT ALL, AND THAT IS WORTH NOTICING.
             Archivo is declared in 50+ places across theme-green.css,
             wall.css and globals.css — and every single one was written as
             `'Archivo', system-ui, sans-serif`. Because the fallback chain
             was correct from the day it was typed, deleting the family from
             THIS URL makes all fifty rules resolve to the device font on
             their own. **A well-written fallback is a switch you didn't know
             you'd installed.**

             ⚠️ It is all-or-nothing: Archivo carried buttons and labels as
             well as body copy, so those move too. That is still what
             Facebook does, but it is wider than "body text".

             ⚠️ Anton, Courier Prime, Fraunces, Permanent Marker and Space
             Grotesk all stay. The character of this app lives in the Anton
             masthead and the Courier Prime timestamps, not in Archivo — and
             looking like Facebook is the opposite of the thing that makes
             somebody show it to a friend.

             🔴 REVERTING IS PUTTING THE FAMILY BACK IN THIS ONE LINE.
             Nothing else has to change. */
          href="https://fonts.googleapis.com/css2?family=Anton&family=Courier+Prime:wght@400;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Permanent+Marker&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Registers the service worker after the page has loaded. Renders
            nothing. Without it Chrome will not offer to install the app. */}
        <RegisterSW />
        {/* Blesses the shared audio element on the first tap, so profile
            songs can start on their own afterwards. See lib/song-audio.js
            for why this is the only thing that works on a phone. */}
        <AudioUnlock />
      </body>
    </html>
  );
}
