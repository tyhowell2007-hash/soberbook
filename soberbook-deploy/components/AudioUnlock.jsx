'use client';

import { useEffect } from 'react';
import { unlockFromGesture } from '../../lib/song-audio';

/* =====================================================================
   THE FIRST TAP.

   Renders nothing. Its whole job is to notice the first real tap anybody
   makes anywhere in the app and use it to bless the shared audio element,
   so that every profile opened afterwards can start its song on its own.

   Ty, Aug 23: "I don't want somebody to have to push a button to hear it
   because they won't." He's right, and this is the only way to honour
   that on a phone — iOS will not let a page start audio out of nothing,
   but it will let a page start audio on an element a person has already
   played once.

   ---------------------------------------------------------------------
   ⚠️ WHY touchend AND click, AND NOT pointerdown.

   Safari counts a gesture as "activating" on touchend, click and keydown.
   pointerdown and touchstart do NOT activate on iOS — a listener on those
   fires perfectly, unlocks nothing, and leaves you certain the code ran.
   That is the single most common way this gets built wrong.

   Both are listened for because they are not redundant: a mouse produces
   click with no touchend, and some in-app taps are cancelled before they
   become clicks.

   ⚠️ CAPTURE PHASE, and it matters. Plenty of controls in this app call
   stopPropagation or re-render away the element that was tapped. Listening
   on the way DOWN the tree means the unlock has already happened before
   any of that can swallow the event.

   ⚠️ { once: true } is deliberately NOT used, because the first attempt
   can legitimately fail — a tap during page setup, or Safari deciding a
   touchend that ended a scroll doesn't count. unlockFromGesture() is
   cheap and returns immediately once it has succeeded, so letting it try
   on every tap until one takes is both harmless and more reliable than
   getting exactly one shot.

   ⚠️ passive: true — this never calls preventDefault, and saying so keeps
   it off the critical path of scrolling. A listener on every touch in the
   app has no business making the page feel heavier.
   ===================================================================== */
export default function AudioUnlock() {
  useEffect(() => {
    const go = () => unlockFromGesture();
    const opts = { capture: true, passive: true };
    document.addEventListener('touchend', go, opts);
    document.addEventListener('click', go, opts);
    document.addEventListener('keydown', go, opts);
    return () => {
      document.removeEventListener('touchend', go, opts);
      document.removeEventListener('click', go, opts);
      document.removeEventListener('keydown', go, opts);
    };
  }, []);

  return null;
}
