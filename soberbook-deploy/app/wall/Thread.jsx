'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { Body, Player } from '../components/Linked';
import ReplyMenu from './ReplyMenu';

/* A post, opened.
   ==========================================================================
   This is the screen that makes "nobody posts into silence" true. Until it
   existed, someone could write "having a rough night" and the app had no
   way for anyone to answer.

   ANONYMITY: replies read from `feed_comments`, never the base table — same
   rule as the Wall. An anonymous reply comes back with author_id NULL and a
   per-thread alias, so a conversation stays followable ("Anonymous Cedar" is
   the same person all the way down this thread) while being impossible to
   correlate with that person anywhere else in the app.
   ========================================================================== */

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

export default function Thread({ post, onClose, onCountChange }) {
  const supabase = browserClient();
  const [rows, setRows] = useState(null);        // null = still loading
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /* Which reply's ⋯ is open. Holds the ROW, not just an id, because the
     menu needs is_mine to decide whether it offers delete or report — and
     is_mine is the only ownership signal that exists here. author_id is
     deliberately NULL on an anonymous reply. */
  const [menuFor, setMenuFor] = useState(null);

  async function load() {
    const { data, error } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [post.id]);

  // Escape closes it. A panel you can't dismiss from the keyboard is a trap.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You seem to be signed out. Reload and try again.');
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        author_id: user.id,
        body,
        is_anonymous: anon,
      });
      if (error) throw error;
      setText('');
      await load();
      onCountChange && onCountChange(post.id);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheetwrap" role="dialog" aria-modal="true" aria-label="Replies">
      <button className="scrim" onClick={onClose} aria-label="Close" />

      <div className="thread">
        <div className="threadbar">
          <span className="tt">
            {post.milestone_days ? `🏅 ${post.milestone_days} days` : post.display_name}
          </span>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="threadbody">
          <p className="orig"><Body text={post.body} /></p>
          <Player text={post.body} />
          <div className="origmeta">
            {ago(post.created_at)}{post.is_anonymous ? ' · anonymous' : ''}
          </div>

          {rows === null && <div className="loading">Loading…</div>}

          {rows !== null && rows.length === 0 && (
            <div className="nosilence">
              Be the first to say something.<br />
              <b>Nobody posts into silence here.</b>
            </div>
          )}

          {rows !== null && rows.map((c) => (
            <div key={c.id} className={'reply' + (c.is_anonymous ? ' screened' : '')}>
              <div className="rwho">
                {c.display_name}
                <span className="rwhen">
                  {ago(c.created_at)}
                  {/* is_mine, never author_id — the author sees their own
                      anonymous reply marked without being exposed to anyone */}
                  {c.is_mine ? ' · yours' : ''}
                </span>
                {/* 🔴 THE WAY IN, ADDED 1 SEPT. Until tonight this row said
                    the word "yours" with nothing to tap — the identical
                    shape as the 19 Aug bug on posts that a member had to
                    report to Ty. The database has allowed a member to
                    delete their own reply since the table was written.
                    ⚠️ Present on EVERY reply including anonymous ones: you
                    report the words, and the queue returns no author, so
                    an anonymous writer can be moderated without ever being
                    unmasked. Proven — a reported anonymous reply comes back
                    with author_handle NULL. */}
                <button type="button" className="rdots"
                        aria-label="More"
                        aria-haspopup="dialog"
                        onClick={() => setMenuFor(c)}>⋯</button>
              </div>
              <p className="rbody"><Body text={c.body} /></p>
              {/* 🔴 THE ACTUAL LINK TY ASKED ABOUT WAS IN A COMMENT, not a
                  post — which is exactly why my first database search for
                  it came back empty. Comments carry links too. */}
              <Player text={c.body} />
            </div>
          ))}

          {err && <div className="rerr">{err}</div>}
        </div>

        {/* ⚠️ Rendered here but PORTALLED to <body> from inside the
            component — see ReplyMenu.jsx. `.thread` is positioned, which
            makes it a stacking context, and a child cannot climb out of
            one with a bigger z-index. That is what left the Cancel button
            dead on the member sheet on 30 Aug.

            onGone re-reads the thread AND asks the wall to refresh, so a
            deleted reply disappears from the reply-count and the preview
            under the post at the same moment it leaves this list. Two
            surfaces, one refresh — otherwise the wall keeps showing words
            that no longer exist. */}
        {menuFor && (
          <ReplyMenu
            reply={menuFor}
            onClose={() => setMenuFor(null)}
            onGone={async () => { await load(); onCountChange && onCountChange(post.id); }}
          />
        )}

        <div className="replybar">
          <button type="button" className={'ranon' + (anon ? ' on' : '')}
                  aria-pressed={anon} onClick={() => setAnon(!anon)}>
            {anon ? '🤫 replying anonymously' : 'reply anonymously?'}
          </button>
          <form onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
                   aria-label="Write a reply"
                   placeholder={anon ? 'Nobody will see who wrote this…' : 'Say something…'} />
            <button type="submit" disabled={busy || !text.trim()}>
              {busy ? '…' : 'Reply'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
