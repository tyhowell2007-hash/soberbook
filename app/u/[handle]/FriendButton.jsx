'use client';

import { useState } from 'react';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   ADD FRIEND / PENDING / FRIENDS / ACCEPT.

   Replaces the follow button from Aug 19. Ty chose one relationship
   instead of two: mutual, with a request in front of it.

   ---------------------------------------------------------------------
   ⚠️ NOT OPTIMISTIC. The button waits for the database before it changes.

   Everywhere else in a social app, flipping the UI instantly and
   reconciling later is correct — it feels fast and the worst case is a
   like that didn't land. Here the worst case is different: a request can
   be refused because one of you blocked the other, and a button that
   said "Pending" and quietly failed would tell somebody they're in a
   queue that doesn't exist.

   Same call as the block button on Aug 6 and the follow button before
   this one. A state that only LOOKS like it worked is dangerous in this
   app in a way it isn't in most.

   ---------------------------------------------------------------------
   🔴 "PENDING" MAY BE A LIE, AND THAT IS THE DESIGN.

   If they ignored you, the database still reports 'pending' and this
   button still says Pending — forever. Nothing here needs to know the
   difference, and nothing here should be able to find out. See 0040 for
   why: telling somebody they were declined hands them a reason to react,
   and the person declining may be avoiding someone dangerous.
   ===================================================================== */

const LABEL = {
  none:     'Add friend',
  pending:  'Requested',
  incoming: 'Accept',
  friends:  'Friends',
};

export default function FriendButton({ handle, initialState }) {
  const supabase = browserClient();
  const [state, setState] = useState(initialState || 'none');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function call(fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data;
  }

  async function primary() {
    setBusy(true); setErr('');
    try {
      if (state === 'none') {
        /* request_friend returns 'sent' | 'accepted' | 'already'.
           'accepted' happens when they had already asked YOU — both
           people said yes, so it just becomes a friendship rather than
           making you go and find a notification you already answered. */
        const r = await call('request_friend', { target_handle: handle });
        setState(r === 'accepted' || r === 'already' ? 'friends' : 'pending');
      } else if (state === 'incoming') {
        await call('accept_friend', { target_handle: handle });
        setState('friends');
      } else if (state === 'friends') {
        setConfirmRemove(true);
      }
      /* 'pending' does nothing on tap. There is no "cancel request",
         because cancelling and re-sending is a way to ping somebody
         repeatedly without ever technically sending them anything. */
    } catch (e) {
      /* The database says "No account by that name." for five different
         failures on purpose. Don't dress it up — an error message is an
         output channel. */
      setErr(e.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true); setErr('');
    try {
      await call('unfriend', { target_handle: handle });
      setState('none'); setConfirmRemove(false);
    } catch (e) {
      setErr("That didn't work.");
    } finally { setBusy(false); }
  }

  async function ignore() {
    setBusy(true); setErr('');
    try {
      await call('ignore_friend', { target_handle: handle });
      /* Back to 'none' for you. They keep seeing 'Requested'. */
      setState('none');
    } catch (e) {
      setErr("That didn't work.");
    } finally { setBusy(false); }
  }

  if (confirmRemove) {
    return (
      <div className="frconfirm">
        <p>Remove {handle} from your people?</p>
        <div className="frrow">
          <button type="button" className="btn out" disabled={busy}
                  onClick={() => setConfirmRemove(false)}>Keep</button>
          <button type="button" className="btn danger" disabled={busy}
                  onClick={remove}>Remove</button>
        </div>
        {/* Said plainly, because "unfriend" quietly doing three things is
            worse than a sentence. */}
        <p className="hint">They aren’t told. Your messages stay.</p>
      </div>
    );
  }

  return (
    <>
      <button type="button"
              className={'btn friend fr-' + state}
              disabled={busy || state === 'pending'}
              onClick={primary}
              aria-live="polite">
        {busy ? '…' : LABEL[state] || 'Add friend'}
      </button>

      {/* Ignore sits next to Accept, same size — you should not have to
          hunt for the quieter option. */}
      {state === 'incoming' && !busy && (
        <button type="button" className="btn out" onClick={ignore}>
          Ignore
        </button>
      )}

      {state === 'pending' && (
        <p className="hint">They’ll see it next time they’re in.</p>
      )}

      {err && <p className="phserr" role="alert">{err}</p>}
    </>
  );
}
