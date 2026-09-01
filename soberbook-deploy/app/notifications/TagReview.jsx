'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   "SOMEBODY TAGGED YOU" — SAY YES OR NO.  31 Aug.

   🔴 THE TWELFTH "EVERYTHING BUILT EXCEPT THE WAY IN".

   my_pending_tags() has existed since 0081 and NOTHING has ever called
   it. There was no screen showing a tag awaiting your approval, and until
   0104 there was no approve_tag() to press either. A tag could land in
   review and stay there for the rest of time.

   ⚠️ It never mattered until tonight because tagging itself was dead —
   the composer read my_friends() and 86 of 126 members have none. Fixing
   the menu without building this would have meant tags landing in a
   queue nobody can see, which is a worse bug than the one being fixed.

   ---------------------------------------------------------------------
   ⭐ WHAT THIS IS, IN FACEBOOK'S WORDS: tag review. Somebody put your
   handle on their post. Until you say yes, post_tags — the view every
   page reads — filters it out, so your handle appears nowhere. The
   approval isn't politeness; it is the thing standing between a stranger
   and your name on their words.

   ⚠️ A FRIEND'S TAG NEVER REACHES HERE. mentions_guard approves those on
   the way in. This queue is only for people you haven't vouched for,
   which is exactly the population it should be about.
   ===================================================================== */

export default function TagReview({ initial }) {
  const [items, setItems] = useState(initial || []);
  const [busy, setBusy] = useState(null);   // post_id currently in flight

  async function decide(postId, yes) {
    setBusy(postId);
    const supabase = browserClient();
    try {
      await supabase.rpc(yes ? 'approve_tag' : 'decline_tag', { p_post_id: postId });
      /* ⚠️ Removed from the list either way. Unlike the ✕ on a
         notification this waits for the answer first — approving puts
         your handle on somebody else's post in public, and "it looked
         like it worked" is not good enough for that. */
      setItems((list) => list.filter((t) => t.post_id !== postId));
    } catch {
      /* Leave it in place; a reload will show the truth. */
    }
    setBusy(null);
  }

  if (!items.length) return null;

  return (
    <>
      {items.map((t) => (
        <div key={t.post_id} className="tagrev">
          <p className="tagrevh">
            {t.tagged_by} tagged you
          </p>
          {t.preview && <p className="tagrevq">“{t.preview}”</p>}
          {/* ⚠️ Says what happens if they do nothing. The default is the
              safe one, and somebody should not have to guess that. */}
          <p className="tagrevp">
            Your handle won’t appear on it unless you say yes.
          </p>
          <div className="tagrevbtns">
            <button
              type="button"
              className="tagrevbtn go"
              disabled={busy === t.post_id}
              onClick={() => decide(t.post_id, true)}
            >
              {busy === t.post_id ? 'One second…' : 'Allow it'}
            </button>
            {/* ⚠️ Same size as Allow, deliberately — same rule as the two
                buttons on the notification ask. A big yes and a small no
                is the standard growth pattern and it is a dark one. */}
            <button
              type="button"
              className="tagrevbtn ghost"
              disabled={busy === t.post_id}
              onClick={() => decide(t.post_id, false)}
            >
              No thanks
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
