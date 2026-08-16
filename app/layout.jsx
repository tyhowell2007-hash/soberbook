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

export const metadata = {
  title: 'Sober Book',
  description: 'You never have to explain yourself here.',
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
             the serif and the warm door doesn't pay for Anton. */
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&family=Courier+Prime:wght@400;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Permanent+Marker&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
