'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   ⋯ ON A MESSAGE IN THE FRONT ROOM.

   🔴 WHY IT HAD TO ARRIVE WITH THE PHOTOS. Up to now the room carried
   text only, and the ⋯ on the Community row below it was enough — you
   could report or block the PERSON. A photo changes the stakes twice
   over: a picture can be harmful on sight in a way a sentence isn't, and
   a moderator needs to know WHICH image, not just which member.

   ⚠️ And the other half is duller and just as necessary: until now there
   was no way to take back a message you'd sent. Shipping pictures into a
   room you cannot delete from would be the eleventh "everything built
   except the way in" this month, and the first one where the missing way
   in is how somebody unpublishes their own face.

   ---------------------------------------------------------------------
   ⚠️ THE MENU IS A SIBLING OF THE BUBBLE, NEVER INSIDE IT. Same rule as
   RowMenu — a <button> inside a <button> is invalid HTML and browsers
   recover from it differently.

   🔴 DELETE AND BLOCK ARE NOT OPTIMISTIC. Both wait for the database
   before the screen changes. A message that appears and then fails is a
   visible retry; a DELETE that only looks like it worked leaves somebody
   believing a photo of their face is gone when it is still on a screen
   in front of eighteen people.
   ===================================================================== */

export default function MsgMenu({ id, mine, name, onGone }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu');   // menu | report | del | done
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const [done, setDone] = useState('');

  function close() {
    setOpen(false); setView('menu'); setErr(''); setDone(''); setBusy(false);
  }

  async function remove() {
    setBusy(true); setErr('');
    /* Through our own route, not the RPC directly — the row and the
       picture files are two different things to destroy, and the route is
       what knows about the second one. Deleting the row from here would
       leave the photos in the bucket. */
    const res = await fetch('/api/room/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (!res.ok) { setErr('Couldn’t do that.'); return; }
    close();
    onGone?.(id);
  }

  async function report(kind) {
    setBusy(true); setErr('');
    const { error } = await browserClient()
      .rpc('report_room_message', { msg_id: id, report_kind: kind, report_reason: null });
    setBusy(false);
    if (error) { setErr('Couldn’t do that.'); return; }
    /* ⚠️ Never promises what will happen or when. */
    setDone('Thank you. Someone will look at this.');
    setView('done');
  }

  async function block() {
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('block_member', { target_handle: name });
    setBusy(false);
    if (error) { setErr('Couldn’t do that.'); return; }
    setDone(`You won’t see ${name} again, and they won’t see you.`);
    setView('done');
  }

  return (
    <>
      <button type="button" className="rmsgdots"
              aria-label={mine ? 'Options for your message' : `Options for ${name}’s message`}
              onClick={() => setOpen(true)}>
        ⋯
      </button>

      {open && (
        <div className="rmenu-wrap" role="dialog" aria-modal="true" onClick={close}>
          <div className="rmenu-card" onClick={(e) => e.stopPropagation()}>
            <div className="rmenu-who">{mine ? 'Your message' : name}</div>

            {err && <div className="err">{err}</div>}

            {view === 'menu' && (mine ? (
              <button type="button" className="rmenu-btn danger" onClick={() => setView('del')}>
                Delete
              </button>
            ) : (
              <>
                <button type="button" className="rmenu-btn" onClick={() => setView('report')}>
                  Report this message
                </button>
                <button type="button" className="rmenu-btn danger" onClick={block} disabled={busy}>
                  {busy ? 'Blocking…' : `Block ${name}`}
                </button>
              </>
            ))}

            {view === 'del' && (
              <>
                <p className="rmenu-note">
                  It goes from everyone’s screen, and any pictures on it are
                  deleted for good.
                </p>
                <button type="button" className="rmenu-btn danger" disabled={busy} onClick={remove}>
                  {busy ? 'Deleting…' : 'Delete it'}
                </button>
              </>
            )}

            {view === 'report' && (
              <>
                <button type="button" className="rmenu-btn tall" disabled={busy}
                        onClick={() => report('rules')}>
                  <span className="rmenu-l1">This breaks the rules</span>
                  <span className="rmenu-l2">Selling, harassing, spam</span>
                </button>
                <button type="button" className="rmenu-btn tall" disabled={busy}
                        onClick={() => report('concern')}>
                  <span className="rmenu-l1">I’m worried about them</span>
                  <span className="rmenu-l2">They may be in danger</span>
                </button>
                {/* 🔴 On the way IN, not after. Somebody reporting a person
                    they are frightened for needs the number now. */}
                <p className="rmenu-note">
                  If someone’s life may be at risk, call or text <strong>988</strong> now.
                </p>
              </>
            )}

            {view === 'done' && <p className="rmenu-note">{done}</p>}

            <button type="button" className="rmenu-cancel" onClick={close}>
              {view === 'done' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
