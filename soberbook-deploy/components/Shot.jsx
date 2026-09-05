'use client';

/* =====================================================================
   A PICTURE THAT REPAIRS ITSELF. 5 Sept.

   ⭐ THE BUG THIS EXISTS FOR, in one line: a signed URL lives an hour,
   0078 hands out a cached one for up to fifty of those minutes, and a
   post photo is `loading="lazy"` — so it is not fetched when the page
   renders, it is fetched when you SCROLL TO IT. Leave a page open,
   come back, scroll down, and every picture below the fold is dead.

   ⭐ THE TELL WAS THE ICON. Ty said broken-image icons, not empty
   frames — so the browser fetched each one and was REFUSED. That single
   word turned "photos are broken" into "old links expire".

   ⭐ AND AVATARS KEPT WORKING THE WHOLE TIME, because avatars are not
   lazy. When one class of image works and another doesn't, compare how
   they LOAD, not where they're stored.

   ---------------------------------------------------------------------
   Wall.jsx got this fix on 5 Sept as four inline onError handlers, and
   Thread.jsx got its own copy an hour later. This is the third and last
   time it gets written: /u/[handle], /me, the rooms and chat all render
   the same expiring URLs and all showed the same broken icons.

   ⚠️ ONE RETRY PER PATH, EVER (`tried`, module-level). Without it a
   genuinely deleted file asks for a new url, fails, asks again, forever
   — and a photo that stays broken is a small bug while a browser
   hammering our own sign endpoint in a loop is our outage.

   ⚠️ The set is MODULE-LEVEL, not per-component, so remounting the same
   picture (scrolling a list, switching rooms) cannot restart the loop.

   🔴 IT IS A CLIENT COMPONENT ON PURPOSE, and that is what lets
   /u/[handle] — a SERVER component — use it. A server page cannot carry
   an onError handler; handlers do not exist on the server. Importing
   the DEFAULT export of a client component is the supported way across
   that boundary. ⚠️ Do NOT add a named export here and import it from a
   server file: Next turns every export of a client module into a client
   reference, and calling one on the server throws. That took /wall down
   for fifteen minutes on 2 Sept.
   ===================================================================== */

import { useState } from 'react';

const tried = new Set();

export default function Shot({ path, src, alt = '', className, onFixed, ...rest }) {
  const [url, setUrl] = useState(src);

  /* Nothing to show yet. ⚠️ Renders NOTHING rather than an <img src="">,
     which draws the browser's torn-page glyph — and to somebody reading
     a conversation that says "they sent you something and it's gone."
     Waiting quietly is the honest state. */
  if (!url) return null;

  async function repair() {
    if (!path || tried.has(path)) return;
    tried.add(path);
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [path] }),
      });
      const { urls } = await res.json();
      if (urls && urls[path]) {
        setUrl(urls[path]);
        /* Let the page cache it too, so its OTHER copies of the same
           picture heal without each one making its own request. */
        if (onFixed) onFixed(path, urls[path]);
      }
    } catch {
      /* Swallowed, same call every media path in this app makes: a
         missing picture beats an error banner over somebody's wall. */
    }
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className} loading="lazy"
         onError={repair} {...rest} />
  );
}
