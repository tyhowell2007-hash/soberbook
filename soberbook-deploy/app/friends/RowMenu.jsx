'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   ⋯ — MESSAGE, REPORT, BLOCK, from a member's row.

   ⭐ 30 AUG: THIS IS NOW USED FROM TWO PLACES, AND THAT IS THE WHOLE
   POINT. It lives under app/friends/ because that is where it was born,
   but app/chat/[id]/Convo.jsx imports it too.

   🔴 It was very tempting to write a second, smaller version for the
   conversation header — it only needs two of the three actions. That is
   exactly the mistake 0046 → 0047 → 0049 made three times in one week:
   a rule written down twice becomes a rule enforced two different ways,
   and the copy nobody is looking at is the one that drifts. Block being
   non-optimistic, report never promising an outcome, the 988 line
   appearing on the way IN rather than after — all of that has to exist
   ONCE. So the only thing that varies between the two callers is the
   label on the first button.

   ⚠️ The .rmenu-* styles live in theme-green.css, NOT friends.css. That
   is what makes this safe to import from /chat — checked before writing
   it, because a component whose stylesheet isn't on the route renders as
   naked HTML and nothing errors.

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

/* primaryLabel / primaryHref describe ONLY the first button.
   - Community row: "Message", which calls onMessage().
   - Conversation:  "Their page", which is a link — you are already in the
     conversation, so offering to start one is nonsense.
   Defaults keep the Community caller byte-identical in behaviour. */
export default function RowMenu({
  handle, name, onMessage,
  primaryLabel = 'Message',
  primaryHref = null,
  afterBlock = null,
}) {
  const [open, setOpen]   = useState(false);
  const [view, setView]   = useState('menu');   // menu | report | block | done
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [done, setDone]   = useState('');
  const [didBlock, setDidBlock] = useState(false);

  /* 🔴 THE SHEET IS PORTALLED TO <body>, AND IT HAS TO BE.

     z-index only ranks you against your SIBLINGS inside the nearest
     stacking context — it is not a global layer number, however much it
     looks like one.

     .rmenu-wrap asks for z-index:60. On the Community list that works,
     because its row makes no stacking context, so the sheet floats to
     the top of the page and 60 means 60. In a conversation the ⋯ lives
     in .mast, which is `position:sticky; z-index:40` — and that MAKES a
     stacking context. Everything inside it, sheet included, gets painted
     at level 40 no matter what number it writes on itself. So the sheet
     rendered UNDERNEATH .cbar (z-index 55, the message box).

     Measured on the live page before this fix — elementsFromPoint at the
     centre of the Cancel button returned, in order:
        FORM.cbar  →  BUTTON.rmenu-cancel  →  .rmenu-card  →  .rmenu-wrap
     The message box was on top of Cancel. A finger there types a
     message; it does not close the sheet. On a sheet whose other option
     is Block, the way OUT being dead is the 29 Aug bug exactly — and
     that one was ALSO invisible in a screenshot, because the covering
     element is drawn transparently over the sheet's own dimmed backdrop.

     ⚠️ You cannot escape a stacking context with a bigger z-index. The
     only fix is to not be inside it. Rendering into <body> puts the
     sheet at the top level for BOTH callers, permanently.

     ⚠️ Mounted-guard because document doesn't exist during the server
     render — createPortal on the server throws. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* ⚠️ afterBlock fires on CLOSE, not on success, and the order matters.
     Blocking somebody from inside their conversation removes the thread
     from chat_threads — so the page you are standing on stops existing
     the moment the block lands. Navigating away immediately would rip
     the confirmation off the screen before it could be read; leaving
     them there means the next tap is a 404. So: confirm, then leave. */
  function close() {
    setOpen(false); setView('menu'); setErr(''); setDone(''); setBusy(false);
    if (didBlock && afterBlock) { setDidBlock(false); afterBlock(); }
  }

  async function block() {
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('block_member', { target_handle: handle });
    setBusy(false);
    if (error) { setErr('Couldn’t do that.'); return; }
    setDidBlock(true);
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
        className="rmenu-dots"
        aria-label={`More options for ${name}`}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>

      {open && mounted && createPortal(
        <div className="rmenu-wrap" role="dialog" aria-modal="true" onClick={close}>
          {/* Stop a tap inside the card from closing it. */}
          <div className="rmenu-card" onClick={(e) => e.stopPropagation()}>
            <div className="rmenu-who">{name}</div>

            {err && <div className="err">{err}</div>}

            {view === 'menu' && (
              <>
                {primaryHref ? (
                  <Link href={primaryHref} className="rmenu-btn" onClick={close}>
                    {primaryLabel}
                  </Link>
                ) : (
                  <button type="button" className="rmenu-btn" onClick={() => { close(); onMessage(); }}>
                    {primaryLabel}
                  </button>
                )}
                <button type="button" className="rmenu-btn" onClick={() => setView('report')}>
                  Report
                </button>
                <button type="button" className="rmenu-btn danger" onClick={() => setView('block')}>
                  Block
                </button>
              </>
            )}

            {view === 'report' && (
              <>
                <button type="button" className="rmenu-btn tall" disabled={busy}
                        onClick={() => report('rules')}>
                  <span className="rmenu-l1">They’re breaking the rules</span>
                  <span className="rmenu-l2">Selling, harassing, spam</span>
                </button>
                <button type="button" className="rmenu-btn tall" disabled={busy}
                        onClick={() => report('concern')}>
                  <span className="rmenu-l1">I’m worried about them</span>
                  <span className="rmenu-l2">They may be in danger</span>
                </button>
                {/* 🔴 Shown on the way IN, not after. Somebody reporting a
                    person they are frightened for needs the number now,
                    not once the form is finished. Matches the post
                    reporter, which has said this since August. */}
                <p className="rmenu-note">
                  If someone’s life may be at risk, call or text <strong>988</strong> now.
                </p>
              </>
            )}

            {view === 'block' && (
              <>
                <p className="rmenu-note">
                  {name} won’t be able to message you, and you won’t see each
                  other here or on the wall.
                </p>
                {/* ⚠️ Says plainly that it can be undone. A permanent-looking
                    button makes people hesitate to protect themselves. */}
                <p className="rmenu-note">You can undo this from your own page.</p>
                <button type="button" className="rmenu-btn danger" disabled={busy} onClick={block}>
                  {busy ? 'Blocking…' : `Block ${name}`}
                </button>
              </>
            )}

            {view === 'done' && <p className="rmenu-note">{done}</p>}

            <button type="button" className="rmenu-cancel" onClick={close}>
              {view === 'done' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
