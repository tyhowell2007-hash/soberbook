'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* The ⋯ menu on a post: report it, or block whoever wrote it.

   THE IMPORTANT DESIGN DECISION IS THE BLOCK.

   You block a POST, not a person. `block_author_of_post(post_id)` runs on
   the server, looks up the author, and writes the block. The browser never
   learns who it blocked.

   Doing it the obvious way — block(author_id) — would need author_id in the
   browser. For an anonymous post the view deliberately sends null, so the
   button would either be missing on exactly the posts that most need it, or
   we'd have to leak the author to make it work. Both are worse than one
   server-side function.

   HONEST CONSEQUENCE, deliberately not spelled out in the UI: blocking
   someone's anonymous post also blocks their open account, because it's the
   same person. That's correct. Saying so on screen would tell the user
   something about who wrote it, which is itself a deanonymisation hint. */
export default function PostMenu({ post, onClose, onBlocked }) {
  const supabase = browserClient();
  const [view, setView] = useState('menu');   // menu | report | blockConfirm | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);     // 'rules' | 'concern'

  async function report(kind) {
    setErr(''); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: 'post',
        target_id: post.id,
        kind,
      });
      if (error) throw error;
      setSent(kind);
      setView('done');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  /* NOT optimistic, unlike the heart.

     A like that shows the wrong state for 300ms is a cosmetic lie. A block
     that *appears* to work and didn't means someone thinks they're safe from
     a person who can still reach them. So: wait for the database, and only
     then close the sheet and refresh the wall. */
  async function block() {
    setErr(''); setBusy(true);
    try {
      const { error } = await supabase.rpc('block_author_of_post', { p_post: post.id });
      if (error) throw error;
      await onBlocked();      // re-read the wall; the view filters them out now
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="sheetwrap">
      <button className="scrim" aria-label="Close" onClick={onClose} />
      <div className="thread menu" role="dialog" aria-modal="true">
        <div className="threadbar">
          <span className="tt">
            {view === 'report' ? "What's wrong?"
              : view === 'blockConfirm' ? 'Block this person?'
              : view === 'done' ? 'Sent' : 'This post'}
          </span>
          <button className="x" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="menubody">

          {view === 'menu' && (
            <>
              <button className="mrow" onClick={() => setView('report')}>
                <span className="mt2">🚩 Report this post</span>
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
              {/* A separate lane, straight from the schema. A person saying
                  they can't do this anymore must not queue behind spam. */}
              <button className="mrow" disabled={busy} onClick={() => report('concern')}>
                <span className="mt2">I&apos;m worried about this person</span>
                <span className="md">
                  They sound like they might be in danger. This goes to the top of
                  the pile, not into the spam queue.
                </span>
              </button>
              <button className="back2" type="button" onClick={() => setView('menu')}>
                back
              </button>
            </>
          )}

          {view === 'blockConfirm' && (
            <>
              <p className="mnote">
                Their posts and replies disappear from your wall, and yours disappear
                from theirs. They&apos;re not told. You can undo this later.
              </p>
              <button className="btn out arm" disabled={busy} onClick={block}>
                {busy ? 'Blocking…' : 'Yes, block them'}
              </button>
              <button className="back2" type="button" onClick={() => setView('menu')}>
                never mind
              </button>
            </>
          )}

          {view === 'done' && (
            <>
              <p className="mnote">
                {sent === 'concern'
                  ? 'Thank you for telling someone. Ty looks at these first.'
                  : "Thanks. Ty reviews reports himself, usually the same day."}
              </p>

              {/* Shown to the PERSON REPORTING, not the person reported.
                  Someone who just flagged a friend in trouble is often
                  shaken themselves, and this is the moment they're holding
                  their phone. Nothing is sent to anyone automatically. */}
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
}
