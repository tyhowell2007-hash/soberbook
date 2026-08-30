'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   PEOPLE YOU'VE BLOCKED — and the way to undo it.

   🔴 THIS EXISTS BECAUSE THE APP MADE A PROMISE A FEW HOURS BEFORE IT
   COULD KEEP ONE. The ⋯ sheet on a member row says "You can undo this
   from your own page." That sentence shipped before this screen did. A
   promise in the interface that the app doesn't honour is the same
   category of thing as the "verified, real people" claim that had to be
   torn out in August — the app saying something that isn't true.

   ⚠️ AND THE UNDO MATTERS MORE THAN IT LOOKS. Before tonight a block was
   permanent AND invisible: `blocks` granted members nothing, so you could
   not lift one and could not even see who you had blocked. That was
   survivable while blocking took a ⋯ on somebody's post. It is not
   survivable now that Block sits on a row in a list of every member,
   one thumb-width from Message, in an app whose members are often having
   the worst night of their week.

   ---------------------------------------------------------------------
   ⚠️ my_blocks() TAKES NO ARGUMENT. There is no shape of this call that
   returns somebody else's blocks — the absence of a parameter IS the
   access control, the same design as my_friends() and my_pending_tags().
   The table itself still grants members nothing.

   ⚠️ An anonymous member appears here as their bare handle, exactly as
   they do everywhere else. Undoing a block must never become a way to
   learn a name you couldn't otherwise see.

   ⚠️ HIDDEN ENTIRELY WHEN THE LIST IS EMPTY. A permanently visible
   "People you've blocked (0)" invites somebody to wonder who they should
   be blocking. Most members will never see this section exist.
   ===================================================================== */

export default function Blocked() {
  const [rows, setRows]   = useState(null);   // null = still loading
  const [busy, setBusy]   = useState(null);
  const [err,  setErr]    = useState('');

  async function load() {
    const { data, error } = await browserClient().rpc('my_blocks');
    if (error) { setRows([]); return; }
    setRows(data || []);
  }

  useEffect(() => { load(); }, []);

  async function unblock(handle) {
    setBusy(handle); setErr('');
    const { error } = await browserClient().rpc('unblock_member', { target_handle: handle });
    setBusy(null);
    if (error) { setErr('Couldn’t do that.'); return; }
    /* ⚠️ Re-read rather than removing the row locally. The database is the
       thing that knows, and a list that only LOOKS updated is the same
       mistake as an optimistic block. */
    load();
  }

  /* Nothing to show, and nothing to announce. */
  if (rows === null || rows.length === 0) return null;

  return (
    <>
      <div className="delsep" />
      <p className="hint">People you’ve blocked</p>
      {err && <div className="err">{err}</div>}
      <ul className="blist">
        {rows.map((b) => (
          <li key={b.handle} className="brow">
            <span className="bname">{b.display_name}</span>
            <button type="button" className="bundo" disabled={busy === b.handle}
                    onClick={() => unblock(b.handle)}>
              {busy === b.handle ? '…' : 'Unblock'}
            </button>
          </li>
        ))}
      </ul>
      {/* 🔴 Said plainly, because it is the surprising part. A block severs
          a friendship in both directions (0038) and lifting the block does
          NOT put it back — coming back into contact is a decision the two
          of you make again, not a side effect of tapping a button. */}
      <p className="hint small">
        Unblocking lets you see each other again. It doesn’t undo anything else.
      </p>
    </>
  );
}
