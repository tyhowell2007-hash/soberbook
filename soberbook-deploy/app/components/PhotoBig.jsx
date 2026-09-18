'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PHOTO_BIG_EVENT } from './photoBig';

/* =====================================================================
   A PICTURE, FULL SIZE. 18 Sept 2026.

   Ty: "just like Facebook, when you post a picture on there, somebody
   can come and click on it and see the bigger picture at its fullity."

   ⭐ ONE VIEWER, MOUNTED ONCE IN THE ROOT LAYOUT. The room already had
   its own (.rbig, friends.css) and the wall, replies, DMs and both
   profile pages had none. Shot.jsx says it plainly about the re-signing
   bug — "this is the third and last time it gets written" — and a second
   photo viewer would be that mistake again, wearing a different name.
   The room's copy is deleted in the same commit; it did not get to stay
   just because it worked.

   🔴 AN OVERLAY, NEVER A NEW TAB. Carried over from the room's version
   and it is the single most important line in this file. Opening a photo
   in a tab puts a SIGNED URL in the address bar, and that link is
   copyable, pasteable, and keeps working for an hour in anybody's
   browser — including somebody who was never in the conversation. In an
   app where the whole promise is that a room is private, that is not a
   small leak. Full size happens here, on top of the page, or not at all.

   ⚠️ IT DRAWS NOTHING UNTIL A PICTURE IS TAPPED. It is in the root
   layout, so it is on the sign-in door and every legal page too. It
   mounts two listeners and returns null, and that is the whole cost.

   ⚠️ THE PATH TRAVELS WITH THE URL, so a tap on an hour-old thumbnail
   opens a real picture instead of a broken frame. See photoBig.js.
   ===================================================================== */

export default function PhotoBig() {
  /* null = closed. Everything else lives inside this one object so the
     overlay can never be half-open with a stale index. */
  const [shot, setShot] = useState(null);
  const [broke, setBroke] = useState(false);
  const closeBtn = useRef(null);
  const opener = useRef(null);
  const touch = useRef(null);

  const close = useCallback(() => setShot(null), []);

  const step = useCallback((d) => {
    setBroke(false);
    setShot((s) => {
      if (!s || s.items.length < 2) return s;
      const n = (s.i + d + s.items.length) % s.items.length;
      return { ...s, i: n };
    });
  }, []);

  /* Opening. ⚠️ Remember what had focus BEFORE the overlay took it, so
     closing puts the keyboard back on the picture that was tapped rather
     than at the top of the page. */
  useEffect(() => {
    const onOpen = (e) => {
      const d = e.detail || {};
      if (!d.items || !d.items.length) return;
      opener.current = document.activeElement;
      setBroke(false);
      setShot({ items: d.items, i: d.i || 0 });
    };
    window.addEventListener(PHOTO_BIG_EVENT, onOpen);
    return () => window.removeEventListener(PHOTO_BIG_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!shot) return;

    /* ⚠️ stopPropagation, same as the drawer: Escape here must not also
       reach a page underneath that closes something of its own. */
    const key = (e) => {
      if (e.key === 'Escape')     { e.stopPropagation(); close(); }
      if (e.key === 'ArrowRight') { e.stopPropagation(); step(1); }
      if (e.key === 'ArrowLeft')  { e.stopPropagation(); step(-1); }
    };
    document.addEventListener('keydown', key);

    /* Hold the page still underneath — without this, pinching or
       scrolling the picture scrolls the wall behind it on iOS and you
       close the photo to find you have lost your place in the feed. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeBtn.current?.focus();

    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
      /* Focus goes back where it came from, if it is still on the page. */
      const back = opener.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [shot, close, step]);

  if (!shot) return null;

  const many = shot.items.length > 1;
  const here = shot.items[shot.i];

  /* A dead signed link, re-signed once. ⚠️ Deliberately NOT the module
     level `tried` set that Shot keeps: that one exists to stop a lazy
     thumbnail hammering the endpoint on every scroll. This fires only
     when a person taps a picture, so once per open is the right ceiling,
     and `broke` resets on every open and every arrow. */
  async function repair() {
    if (broke || !here.path) { setBroke(true); return; }
    setBroke(true);
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [here.path] }),
      });
      const { urls } = await res.json();
      const fresh = urls && urls[here.path];
      if (fresh) {
        setBroke(false);
        setShot((s) => {
          if (!s) return s;
          const items = s.items.slice();
          items[s.i] = { ...items[s.i], url: fresh };
          return { ...s, items };
        });
      }
    } catch {
      /* Swallowed, same as everywhere else that touches media here: a
         picture that will not open beats an error banner over the page. */
    }
  }

  return (
    <div className="pbig" role="dialog" aria-modal="true"
         aria-label={many ? `Picture ${shot.i + 1} of ${shot.items.length}` : 'Picture'}
         /* Tapping the dark area closes. ⚠️ Guarded on currentTarget, or
            a tap on the picture itself closes it too — which is how you
            lose a photo the moment you try to look at it properly. */
         onClick={(e) => { if (e.target === e.currentTarget) close(); }}
         onTouchStart={(e) => {
           touch.current = e.changedTouches[0]
             ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : null;
         }}
         onTouchEnd={(e) => {
           /* Swipe, but only a deliberate one: 48px across and more
              sideways than up, so scrolling a tall picture with a thumb
              does not flick to the next one. */
           const t = touch.current, f = e.changedTouches[0];
           touch.current = null;
           if (!t || !f || !many) return;
           const dx = f.clientX - t.x, dy = f.clientY - t.y;
           if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
         }}>

      {broke && !here.url ? (
        <p className="pbig-gone">That picture isn’t there any more.</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pbig-img" src={here.url} alt="" onError={repair} />
      )}

      {many && (
        <>
          <button type="button" className="pbig-arrow pbig-prev"
                  aria-label="Previous picture"
                  onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>
          <button type="button" className="pbig-arrow pbig-next"
                  aria-label="Next picture"
                  onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>
          <p className="pbig-count">{shot.i + 1} of {shot.items.length}</p>
        </>
      )}

      <button ref={closeBtn} type="button" className="pbig-x"
              onClick={(e) => { e.stopPropagation(); close(); }}>Close</button>
    </div>
  );
}
