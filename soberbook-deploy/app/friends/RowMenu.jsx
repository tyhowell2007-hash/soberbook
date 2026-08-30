'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   ⋯ — MESSAGE, REPORT, BLOCK, from a member's row.

   🔴 WHY THIS HAD TO EXIST TONIGHT. Until 0090 the only way to block
   anybody was block_author_of_post(post_id) — it needed a POST. Eleven of
   the eighteen members have never posted, so eleven people could not be
   blocked at all. And 0087 had just removed the cap that stopped a
   stranger sending more than one message. Those two facts together are a
   hole, and this is the way in that closes it.

   ⚠️ It is also the tenth thing this month that was fully built with no
   way to reach it: reports.target_type has allowed 'profile' since the
   table was written and nothing ever inserted one.

   ---------------------------------------------------------------------
   ⚠️ THE MENU IS A SIBLING OF THE ROW BUTTON, NEVER INSIDE IT. A <button>
   nested in a <button> is invalid HTML; browsers recover from it in
   different ways and the inner one stops being reliably clickable. Same
   reason the reply preview on the Wall sits outside its post button.

   🔴 BLOCK IS NOT OPTIMISTIC. It waits for the database and only then
   says so. This is the Aug 6 rule and it is the opposite of the choice
   made for a room message a few files away: a message that appears and
   then fails is a visible retry, but a block that only LOOKS like it
   worked leaves somebody believing they are safe from a person who can
   still reach them.
   ===================================================================== */

export default function RowMenu({ handle, name, onMessage }) {
  const [open, setOpen]   = useState(false);
  const [view, setView]   = useState('menu');   // menu | report | block | done
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [done, setDone]   = useState('');

  function close() {
    setOpen(false); setView('menu'); setErr(''); setDone(''); setBusy(false);
  }

  async function block() {
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('block_member', { target_handle: handle });
    setBusy(false);
    if (error) { setErr('Couldn’t do that.'); return; }
    setDone(`You won’t see ${name} again, and they won’t see you.`);
    setView('done');
  }

  async function report(kind) {
    setBusy(true); setErr('');
    const { error } = await browserClient()
      .rpc('report_member', { target_handle: handle, report_kind: kind, report_reason: null });
    setBusy(false);
    if (error) { setErr('Couldn’t do that.'); return; }
    /* ⚠️ Never says whether anything will happen, or when. A promise about
       moderation we can't keep is worse than none. */
    setDone('Thank you. Someone will look at this.');
    setView('done');
  }

  return (
    <>
      <button
        type="button"
        className="rowdots"
        aria-label={`More options for ${name}`}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>

      {open && (
        <div className="sheetwrap" role="dialog" aria-modal="true" onClick={close}>
          {/* Stop a tap inside the card from closing it. */}
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheetwho">{name}</div>

            {err && <div className="err">{err}</div>}

            {view === 'menu' && (
              <>
                <button type="button" className="sheetbtn" onClick={() => { close(); onMessage(); }}>
                  Message
                </button>
                <button type="button" className="sheetbtn" onClick={() => setView('report')}>
                  Report
                </button>
                <button type="button" className="sheetbtn danger" onClick={() => setView('block')}>
                  Block
                </button>
              </>
            )}

            {view === 'report' && (
              <>
                <button type="button" className="sheetbtn tall" disabled={busy}
                        onClick={() => report('rules')}>
                  <span className="sb1">They’re breaking the rules</span>
                  <span className="sb2">Selling, harassing, spam</span>
                </button>
                <button type="button" className="sheetbtn tall" disabled={busy}
                        onClick={() => report('concern')}>
                  <span className="sb1">I’m worried about them</span>
                  <span className="sb2">They may be in danger</span>
                </button>
                {/* 🔴 Shown on the way IN, not after. Somebody reporting a
                    person they are frightened for needs the number now,
                    not once the form is finished. Matches the post
                    reporter, which has said this since August. */}
                <p className="sheetnote">
                  If someone’s life may be at risk, call or text <strong>988</strong> now.
                </p>
              </>
            )}

            {view === 'block' && (
              <>
                <p className="sheetnote">
                  {name} won’t be able to message you, and you won’t see each
                  other here or on the wall.
                </p>
                {/* ⚠️ Says plainly that it can be undone. A permanent-looking
                    button makes people hesitate to protect themselves. */}
                <p className="sheetnote">You can undo this from your own page.</p>
                <button type="button" className="sheetbtn danger" disabled={busy} onClick={block}>
                  {busy ? 'Blocking…' : `Block ${name}`}
                </button>
              </>
            )}

            {view === 'done' && <p className="sheetnote">{done}</p>}

            <button type="button" className="sheetcancel" onClick={close}>
              {view === 'done' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
