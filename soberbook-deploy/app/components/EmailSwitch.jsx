'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   EMAIL WHEN SOMEBODY ANSWERS YOU — the switch.  31 Aug.

   ⭐ WHY THIS EXISTS AT ALL, when push already does the same job: push
   reaches 3 of 125 members. It needs a permission, and on an iPhone it
   needs the app installed to the home screen before it can even ask.
   Email needs neither. This is the only channel that works for
   everybody, which is why it is the only one that is ON by default.

   ⚠️ AND THAT DEFAULT IS WHY THIS CONTROL HAS TO EXIST AND HAS TO BE
   EASY TO FIND. The unsubscribe link in every email says "you can switch
   these back on any time from your own page." That sentence is only
   true if this is here. Until 0103 it wasn't even possible — the column
   was readable but not updatable, so the promise would have been a lie
   the database enforced.

   ---------------------------------------------------------------------
   🔴 IT SITS UNDER THE PUSH SWITCH, NOT ABOVE IT. Push is the better
   experience when it works; email is the one that always works. Somebody
   reading down the page should meet the good option first.
   ===================================================================== */

export default function EmailSwitch() {
  const [on, setOn] = useState(null);   // null = still asking
  const [busy, setBusy] = useState(false);

  /* ⚠️ TRUST THE SERVER, NOT A GUESS. Same rule PushSwitch learned on
     26 Aug, when it read "Turn it off" while the subscriptions table was
     empty. The only honest source for "are emails on" is the row. */
  useEffect(() => {
    (async () => {
      const supabase = browserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles').select('email_replies').eq('id', user.id).maybeSingle();
      setOn(data?.email_replies !== false);
    })();
  }, []);

  async function flip(next) {
    setBusy(true);
    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles').update({ email_replies: next }).eq('id', user.id);
    /* ⚠️ Not optimistic. Somebody turning this OFF may be doing it
       because their inbox is shared — "it looked like it worked" is not
       good enough for that person. Read the answer, then move the UI. */
    if (!error) setOn(next);
    setBusy(false);
  }

  if (on === null) return null;   // say nothing rather than guess

  return (
    <div className="pushbox">
      <h3 className="pushh">Email me too</h3>
      <p className="pushp">
        When somebody answers you or sends you a message, we&rsquo;ll email you
        so you know even if the app is shut. <strong>It never says who, or
        what they wrote</strong> — the email only says somebody did.
      </p>

      {on ? (
        <>
          <p className="pushon">On.</p>
          <button type="button" className="btn out" disabled={busy}
                  onClick={() => flip(false)}>
            {busy ? 'One second…' : 'Turn it off'}
          </button>
        </>
      ) : (
        <button type="button" className="btn" disabled={busy}
                onClick={() => flip(true)}>
          {busy ? 'One second…' : 'Turn it on'}
        </button>
      )}
    </div>
  );
}
