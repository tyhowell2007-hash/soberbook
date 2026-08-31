'use client';

import { useEffect } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   MARK READ — ONLY WHAT THIS PAGE ACTUALLY SHOWED.

   🔴 THIS IS THE 0027 RULE AND IT WAS LEARNED THE HARD WAY: "each tab
   clears ONLY its own dot; a blanket mark-read ate messages."

   `notifications_mark_read()` takes a kind, and with NULL it clears
   EVERYTHING. Calling it that way from here would be the same bug in a
   new place, so it is called twice, explicitly, with the two kinds this
   page is entitled to clear.

   ---------------------------------------------------------------------
   ⭐ THE PRINCIPLE, AND IT IS WORTH STATING BECAUSE IT DECIDES THE LIST:
   **a surface may mark read exactly what it displayed the contents of.**

   - A REPLY row shows who answered and an excerpt of the post they
     answered. Reading the row is genuinely reading the notification —
     there is nothing further to see. Clear it. (It also clears the Home
     dot, which reads from the same rows, and that is correct: you did
     see them.)

   - A MENTION row is the same shape. Clear it. ⚠️ A mention currently
     lights NO dot anywhere — my_nav_dots only checks 'reply' and
     'message' — so before this page existed a mention was completely
     invisible. This page is the first surface that shows one at all.

   - A MESSAGE row shows "Kenny K sent you a message" and NOT the
     message. Reading that is not reading the message. Clearing it would
     put out the Chat dot for something you haven't opened, and you'd
     walk into Chat with no idea which thread was new. **Messages are
     Chat's to clear, in the thread, where the words actually are.**

   ⚠️ So the bell can still show unread messages after you've visited it.
   That is not a bug; it is the dot telling the truth.
   ===================================================================== */

export default function MarkSeen() {
  useEffect(() => {
    /* ⚠️ Fire and forget, and never throw. This renders inside a page
       that has already delivered the content; a failed mark-read means a
       dot stays lit one refresh longer, which is a nuisance. An
       unhandled rejection here would be a white screen on the one page
       somebody opened to find out whether anybody cared. */
    (async () => {
      const supabase = browserClient();
      try { await supabase.rpc('notifications_mark_read', { p_kind: 'reply' }); } catch { /* dot survives */ }
      try { await supabase.rpc('notifications_mark_read', { p_kind: 'mention' }); } catch { /* dot survives */ }
    })();
  }, []);

  return null;
}
