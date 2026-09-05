'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE ⋯ ON A REPLY.  1 Sept.

   Delete your own · report or block anyone else's.

   🔴 WHY THIS EXISTS: before tonight a reply had no ⋯ at all. Which meant
   `reports.target_type` had allowed 'comment' since the table was written,
   `report_queue` already joined comments — and ZERO comment reports had
   ever been filed. And members had held DELETE on `comments` with a
   policy of `author_id = current_uid()` the whole time, and nobody had
   ever been able to take back a reply. Twelfth time in this project that
   something was fully built with no way in.

   ⚠️ REPLIES ARE THE MORE PRIVATE HALF OF THE APP. The post says "rough
   night"; the answers name the drink, the ex, the court date. Somebody
   answers at 2am, says more than they meant to, and wakes up — that
   person needs a delete button more than they need anything else here.

   ---------------------------------------------------------------------
   🔴 PORTALLED TO <body>, AND THAT IS NOT A DETAIL.

   A reply lives inside Thread.jsx, which is a `.sheetwrap` containing a
   positioned `.thread`. A positioned ancestor CREATES A STACKING CONTEXT,
   and a child can never escape one by asking for a bigger z-index. That
   is exactly what killed the Cancel button on the member sheet on 30 Aug
   — it asked for 60, lived inside a `position:sticky; z-index:40` parent,
   and rendered underneath anyway. The fix then was a portal and it is the
   fix now. **You cannot escape a stacking context with a bigger number.**
   ===================================================================== */
export default function ReplyMenu({ reply, onClose, onGone }) {
  const supabase = browserClient();
  const [view, setView] = useState('menu');   // menu | report | blockConfirm | delConfirm | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);     // 'rules' | 'concern'

  /* A plain insert, because reporting needs no server-side lookup — the
     report carries the comment's id and nothing about who wrote it.
     ⚠️ Deliberately the same shape PostMenu uses, so the two cannot
     drift into behaving differently on the same complaint. */
  async function report(kind) {
    setErr(''); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: 'comment',
        target_id: reply.id,
        kind,
      });
      if (error) throw error;
      setSent(kind);
      setView('done');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  /* 🔴 AN RPC, NOT A DELETE, AND THE REASON IS A TRAP THAT WAS ALREADY
     LOADED. Members hold DELETE on `comments` and NO SELECT on any
     column. The delete policy reads `author_id`, and a DELETE whose RLS
     clause reads a column needs SELECT on that column — so
     `.delete().eq('id', …)` fails with permission denied and looks
     exactly like "delete is broken". Identical to the posts bug on
     23 Aug. `delete_my_comment()` is SECURITY DEFINER, so the browser
     never needs to read the table at all.

     ⚠️ NOT optimistic. The reply disappears when the database says it is
     gone, never before. Somebody deleting something they regret has to
     know it is actually gone, and a row that vanishes locally while the
     request quietly fails is a lie told at the worst possible moment. */
  async function del() {
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('delete_my_comment', { p_comment: reply.id });
      if (error) throw error;
      if (data === false) throw new Error('That reply is no longer yours to delete.');
      await onGone();
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  /* 🔴 TAKES THE REPLY'S ID, NEVER AN AUTHOR ID. `feed_comments` sends
     author_id as NULL for an anonymous reply, so block(author) would be
     missing on exactly the replies that most need it — or we would have
     to leak the writer to the browser to make the button work. The
     lookup happens on the server and the browser never learns who it
     blocked. Same reasoning as block_author_of_post(). */
  async function block() {
    setErr(''); setBusy(true);
    try {
      const { error } = await supabase.rpc('block_author_of_comment', { p_comment: reply.id });
      if (error) throw error;
      await onGone();
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  const sheet = (
    /* ⚠️ `rplmenu`, NOT `rmenu` — `.rmenu-row`/`.rmenu-dots` already belong
       to the Front Room in theme-green.css. Checked before writing. */
    <div className="sheetwrap rplmenu">
      <button className="scrim" aria-label="Close" onClick={onClose} />
      <div className="thread menu" role="dialog" aria-modal="true">
        <div className="threadbar">
          <span className="tt">
            {view === 'report' ? "What's wrong?"
              : view === 'blockConfirm' ? 'Block this person?'
              : view === 'delConfirm' ? 'Delete this reply?'
              : view === 'done' ? 'Sent'
              : reply.is_mine ? 'Your reply' : 'This reply'}
          </span>
          <button className="x" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="menubody">

          {/* ⚠️ YOUR OWN REPLY GETS ONLY DELETE. Reporting or blocking
              yourself is nonsense, so those rows are absent rather than
              greyed out — a dead control is an invitation to work out how
              to enable it. */}
          {view === 'menu' && reply.is_mine && (
            <button className="mrow danger" onClick={() => setView('delConfirm')}>
              <span className="mt2">🗑 Delete this reply</span>
              <span className="md">Takes your words off this post for good.</span>
            </button>
          )}

          {view === 'delConfirm' && (
            <>
              {/* ⚠️ Says the true consequence and no more. It does NOT say
                  "nobody will be told" as reassurance — deleting a reply
                  somebody already read is visible to them by its absence,
                  and promising otherwise would be the app making a claim
                  it cannot keep. */}
              <p className="mnote">
                This cannot be undone. If somebody has already read it, they
                have already read it — this takes it off the post from now on.
              </p>
              <button className="mrow danger" disabled={busy} onClick={del}>
                <span className="mt2">{busy ? 'Deleting…' : 'Yes, delete it'}</span>
              </button>
              <button className="mrow" disabled={busy} onClick={() => setView('menu')}>
                <span className="mt2">Never mind</span>
                <span className="md">Leave it up.</span>
              </button>
            </>
          )}

          {view === 'menu' && !reply.is_mine && (
            <>
              <button className="mrow" onClick={() => setView('report')}>
                <span className="mt2">🚩 Report this reply</span>
                <span className="md">Something here breaks the rules, or worries me.</span>
              </button>
              <button className="mrow danger" onClick={() => setView('blockConfirm')}>
                <span className="mt2">🚫 Block whoever wrote this</span>
                <span className="md">You stop seeing them. They stop seeing you.</span>
              </button>
            </>
          )}

          {view === 'report' && (
            <>
              <button className="mrow" disabled={busy} onClick={() => report('rules')}>
                <span className="mt2">It breaks the rules</span>
                <span className="md">
                  Spam, selling, harassment, someone pushing treatment or product.
                </span>
              </button>
              {/* The separate lane, straight from the schema. A person
                  saying they can't do this anymore must not queue behind
                  spam. ⚠️ This matters more under a post than on one: the
                  frightening sentence is usually in the replies. */}
              <button className="mrow" disabled={busy} onClick={() => report('concern')}>
                <span className="mt2">I&apos;m worried about this person</span>
                <span className="md">
                  They sound like they might be in danger. This goes to the top of
                  the pile, not into the spam queue.
                </span>
              </button>
              <button className="back2" type="button" onClick={() => setView('menu')}>back</button>
            </>
          )}

          {view === 'blockConfirm' && (
            <>
              <p className="mnote">
                Their posts and replies disappear from your wall, and yours disappear
                from theirs. They&apos;re not told. You can undo this later on your page.
              </p>
              <button className="btn out arm" disabled={busy} onClick={block}>
                {busy ? 'Blocking…' : 'Yes, block them'}
              </button>
              <button className="back2" type="button" onClick={() => setView('menu')}>never mind</button>
            </>
          )}

          {view === 'done' && (
            <>
              <p className="mnote">
                {sent === 'concern'
                  ? 'Thank you for telling someone. Ty looks at these first.'
                  : 'Thanks. Ty reviews reports himself, usually the same day.'}
              </p>
              {/* Shown to the PERSON REPORTING, not the person reported.
                  Someone who just flagged a friend in trouble is often
                  shaken themselves, and this is the moment they are
                  holding their phone. Nothing is sent to anyone
                  automatically. */}
              {sent === 'concern' && (
                <p className="mnote soft">
                  If you&apos;re carrying something heavy yourself right now, you can
                  call or text <b>988</b> any time — the Suicide &amp; Crisis Lifeline.
                  You don&apos;t have to be in crisis to use it.
                </p>
              )}
              <button className="btn" type="button" onClick={onClose}>Close</button>
            </>
          )}

          {err && <div className="rerr">{err}</div>}
        </div>
      </div>
    </div>
  );

  /* ⚠️ Guarded, because this component renders on the server pass too and
     `document` does not exist there. Returning null for one frame is
     correct; throwing would white-screen the thread. */
  return typeof document === 'undefined' ? null : createPortal(sheet, document.body);
}
