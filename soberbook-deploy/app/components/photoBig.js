/* =====================================================================
   OPENING A PICTURE FULL SIZE — the tiny bit that isn't the overlay.

   ⚠️ A CUSTOM EVENT, NOT A SHARED MODULE VARIABLE, and that is on
   purpose. Shot.jsx already carries the scar: Next turns every export of
   a client module into a client reference, /u/[handle] is a SERVER page
   that renders <Shot>, and the last time an import crossed that boundary
   the wrong way /wall was down for fifteen minutes on 2 Sept. An event
   on `window` cannot be called on the server by accident — there is no
   window there — and it needs no shared instance between bundles.

   ⚠️ ITEMS CARRY THE PATH AS WELL AS THE URL. A signed link lives an
   hour and 0078 hands out a cached one for up to fifty minutes of it, so
   the link that drew a thumbnail can be dead by the time somebody taps
   it. The overlay re-signs from the path, exactly as <Shot> does for the
   thumbnail. Pass url alone and a tapped photo can open to nothing.
   ===================================================================== */

export const PHOTO_BIG_EVENT = 'sb:photo-big';

/* items: [{ path, url }]   i: which one was tapped */
export function openPhoto(items, i = 0) {
  if (typeof window === 'undefined') return;
  const clean = (items || []).filter((it) => it && it.url);
  if (!clean.length) return;
  const at = Math.max(0, Math.min(i, clean.length - 1));
  window.dispatchEvent(new CustomEvent(PHOTO_BIG_EVENT, { detail: { items: clean, i: at } }));
}
