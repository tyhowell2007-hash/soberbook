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
export default function PostMenu({ post, onClose, onBlocked, onEdited }) {
  const supabase = browserClient();
  const [view, setView] = useState('menu');   // menu | report | blockConfirm | delConfirm | edit | done
  /* The words being edited. ⚠️ Seeded when the row is tapped, not here —
     the menu is mounted for other people's posts too, and post.body is
     null on an anonymous one you cannot edit anyway. */
  const [draft, setDraft] = useState('');
  const [toFriends, setToFriends] = useState(false);
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
  /* ⚠️ DELETING YOUR OWN POST WAS MISSING ENTIRELY UNTIL AUG 19, and a
     member hit it before we did. The database has always allowed it and
     the API route has existed since the photo work — but the wall showed
     a plain "yours" label with nothing to tap, and the ⋯ was hidden on
     your own posts on the grounds that there was nobody to report or
     block but yourself. True, and it left no room for the one control
     you actually need.

     ⭐ It goes through the SAME route /me uses. A second delete path
     would be a second place to forget the photo, the video, and the
     storage cleanup — and the one that drifts is always the one nobody
     is reading.

     No optimistic update: the post disappears when the server says it's
     gone, not before. Somebody deleting something they regret needs to
     know it is actually gone, and a row that vanishes locally while the
     request fails is a lie told at the worst possible moment. */
  /* Saving an edit (0070).

     🔴 An RPC, not an UPDATE. Members hold UPDATE on exactly one column of
     posts — audience — and no SELECT at all, so an update whose WHERE
     reads author_id is a grant that is real and unusable. Same shape as
     delete_my_post(). */
  async function save() {
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('edit_my_post', {
        p_post: post.id,
        p_body: draft,
        /* ⚠️ null, not the current value, when nothing is changing. The
           function only checks the narrowing rule when it is handed an
           audience, so sending the same one back would make every edit
           re-run a check it does not need. */
        p_audience: toFriends ? 'friends' : null,
      });
      if (error) throw new Error(error.message);
      if (data === false) throw new Error('That post is no longer yours to edit.');
      /* ⚠️ Hand the new words back rather than making the wall re-fetch.
         The drops bug: waiting for a server round trip is how an edit
         looks like it did nothing for a second and a half. */
      if (onEdited) onEdited(post.id, draft, toFriends ? 'friends' : post.audience);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/photo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "That couldn't be deleted.");
      }
      await onBlocked();          // same re-read of the wall
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

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
              : view === 'delConfirm' ? 'Delete this?'
              : view === 'edit' ? 'Edit this post'
              : view === 'done' ? 'Sent' : 'This post'}
          </span>
          <button className="x" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="menubody">

          {/* ⚠️ YOUR OWN POST GETS A DIFFERENT MENU. Reporting or blocking
              yourself is nonsense, so those rows are absent rather than
              greyed out — a dead control is an invitation to work out how
              to enable it. */}
          {/* ⭐ EDIT SITS ABOVE DELETE, and not only because it's gentler.
              These two are the only rows on your own post, and the
              destructive one should never be the first thing your thumb
              lands on. */}
          {view === 'menu' && post.is_mine && (
            <button className="mrow" onClick={() => { setDraft(post.body || ''); setView('edit'); }}>
              <span className="mt2">✏️ Edit this post</span>
              <span className="md">
                Change the words. {post.comment_count > 0
                  ? 'People have replied, so it will show as edited.'
                  : 'Nobody has replied yet, so nothing will show.'}
              </span>
            </button>
          )}

          {/* ---- editing (0070) ---- */}
          {view === 'edit' && (
            <>
              <textarea className="editbox" value={draft} maxLength={5000}
                        autoFocus rows={5} disabled={busy}
                        aria-label="The words on your post"
                        onChange={(e) => setDraft(e.target.value)} />

              {/* 🔴 Says what will happen BEFORE it happens. An "edited"
                  mark that appears as a surprise afterwards is the kind of
                  thing people feel tricked by. */}
              {post.comment_count > 0 && (
                <p className="mnote">
                  {post.comment_count === 1 ? 'Somebody has' : `${post.comment_count} people have`}
                  {' '}already replied to this. Their answers stay, and the post will
                  carry a small “edited” mark from now on — so nobody's reply
                  can be quietly pointed at different words.
                </p>
              )}

              {/* ⚠️ Narrowing only, and OFFERED only in that direction.
                  edit_my_post() refuses to widen; showing a control that
                  the database will reject is how you get an error nobody
                  can act on. */}
              {post.audience === 'open' && !post.is_anonymous && (
                <label className="editaud">
                  <input type="checkbox" checked={toFriends} disabled={busy}
                         onChange={(e) => setToFriends(e.target.checked)} />
                  Keep this to friends from now on
                </label>
              )}

              {err && <p className="phserr" role="alert">{err}</p>}

              <button className="mrow" disabled={busy || !draft.trim()} onClick={save}>
                <span className="mt2">{busy ? 'Saving…' : 'Save changes'}</span>
              </button>
              <button className="mrow" disabled={busy} onClick={() => { setErr(''); setView('menu'); }}>
                <span className="mt2">Never mind</span>
              </button>
            </>
          )}

          {view === 'menu' && post.is_mine && (
            <button className="mrow danger" onClick={() => setView('delConfirm')}>
              <span className="mt2">🗑 Delete this post</span>
              <span className="md">
                Takes it off the wall for good, along with any photo or video on it.
              </span>
            </button>
          )}

          {view === 'delConfirm' && (
            <>
              <p className="mnote">
                This cannot be undone. Any replies underneath go with it.
              </p>
              <button className="mrow danger" disabled={busy} onClick={del}>
                <span className="mt2">{busy ? 'Deleting…' : 'Yes, delete it'}</span>
                <span className="md">Gone from the wall and from your page.</span>
              </button>
              <button className="mrow" disabled={busy} onClick={() => setView('menu')}>
                <span className="mt2">Never mind</span>
                <span className="md">Leave it up.</span>
              </button>
            </>
          )}

          {view === 'menu' && !post.is_mine && (
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
