'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { Body, Player } from '../components/Linked';
import { useTagBox, useTaggablePeople, tellThemTheyWereTagged } from '../components/TagBox';
import PhotoUpload from '../components/PhotoUpload';
import EmojiPicker from '../friends/EmojiPicker';
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

  /* ---- tagging in a reply (5 Sept) ----
     ⚠️ enabled is `!anon`, exactly as on the Wall. An anonymous reply CAN
     carry a mention — unlike an anonymous post, which mentions_guard
     refuses outright — but offering the menu while anonymous invites
     somebody to think about who they are naming at the same moment they
     are trying not to be named. The @ still works if they type it. */
  const boxRef = useRef(null);
  const people = useTaggablePeople();
  const tag = useTagBox({ text, setText, boxRef, people, enabled: !anon });
  /* Pictures staged for this reply, and the emoji sheet. */
  const [tray, setTray] = useState([]);
  const [upBusy, setUpBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [urls, setUrls] = useState({});     // path -> signed link

  async function load() {
    const { data, error } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);

    /* 🔴 ASK FOR THE PICTURES. feed_comments hands back paths, not links —
       a path nobody asks to sign never gets a URL and renders as nothing.
       Swallowed on failure: a reply with no picture beats no reply. */
    const want = [];
    for (const c of data || []) for (const p of c.photo_urls || []) if (p) want.push(p);
    if (want.length) {
      try {
        const res = await fetch('/api/photo/sign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: want }),
        });
        const j = await res.json();
        if (j && j.urls) setUrls((u) => ({ ...u, ...j.urls }));
      } catch { /* leave them unsigned */ }
    }
  }

  /* 🔴 A DEAD SIGNED URL REPAIRS ITSELF, ONCE. A signed link lives an
     hour and 0078 reuses it for fifty minutes, so a sheet left open goes
     stale and every picture below the fold 404s. ⚠️ ONE retry per path,
     ever: without the guard a genuinely deleted file asks, fails, and
     asks again forever — a broken picture is a small bug, a browser
     hammering our own endpoint in a loop is our outage. (5 Sept, Wall.) */
  const retried = useRef(new Set());
  async function reSign(path) {
    if (!path || retried.current.has(path)) return;
    retried.current.add(path);
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [path] }),
      });
      const { urls: fresh } = await res.json();
      if (fresh && fresh[path]) setUrls((u) => ({ ...u, [path]: fresh[path] }));
    } catch { /* a missing picture beats an error banner */ }
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
    /* ⭐ A PICTURE IS A REPLY. 0134 dropped the NOT NULL on comments.body
       for exactly this — answering with a photo and no words is a real
       answer, and often the kindest one. */
    if (!body && tray.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You seem to be signed out. Reload and try again.');

      /* 🔴 THE ID IS MADE HERE AND SENT WITH THE ROW, NEVER READ BACK.
         Members hold INSERT on comments and no SELECT, so appending
         `.select()` or a RETURNING clause is refused with 42501 — a
         RETURNING clause is a read (23 Aug, fourth appearance). We need
         to know the id to tell the people who were named, and the only
         way to know it is to have chosen it. Same shape as posts. */
      const commentId = crypto.randomUUID();
      const named = tag.handles;

      const { error } = await supabase.from('comments').insert({
        id: commentId,
        post_id: post.id,
        author_id: user.id,
        body: body || null,
        is_anonymous: anon,
        /* ⚠️ null, not [] — comment_photo_paths_ok allows null or 1..10,
           and an empty array is neither. Sending [] for a words-only
           reply is refused by the CHECK and reads as "replying is
           broken". Same trap the room composer already carries. */
        photo_urls: tray.length ? tray.map((t) => t.path) : null,
      });
      if (error) throw error;

      /* ⚠️ AFTER the insert and never awaited into the failure path. The
         reply is already saved; a notification that doesn't fire must not
         be able to make it look like the reply didn't land. */
      tellThemTheyWereTagged('comment', commentId, named);

      setText('');
      setTray([]);
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
          <p className="orig"><Body text={post.body} tags={people} /></p>
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
              {/* 💬 Pictures on a reply (0133). ⚠️ An unsigned path draws
                  NOTHING rather than a broken-image icon — the same call
                  the DM screen makes, and for the same reason: a torn
                  page glyph reads as "they sent something and it's gone."
                  ⚠️ onError re-signs once, so an hour-old sheet repairs
                  itself instead of showing broken frames (5 Sept). */}
              {(c.photo_urls || []).filter(Boolean).length > 0 && (
                <div className="rpics">
                  {(c.photo_urls || []).filter(Boolean).map((p) => (urls[p] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p} src={urls[p]} alt="" className="rpic" loading="lazy"
                         onError={() => reSign(p)} />
                  ) : null))}
                </div>
              )}
              {c.body && <p className="rbody"><Body text={c.body} tags={people} /></p>}
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
          {/* ⚠️ ABOVE the bar, not under it. The reply box sits at the
              bottom of the sheet, so a menu rendered below it would open
              off-screen — on a phone, straight behind the keyboard. The
              Wall can afford to put it underneath because its composer is
              at the TOP of the page. Same menu, opposite direction. */}
          {tag.menu}
          <EmojiPicker open={emoji} onClose={() => setEmoji(false)} onPick={tag.insertEmoji} />
          {tray.length > 0 && (
            <div className="rtray">
              {tray.map((t) => (
                <div key={t.path} className="rtray-one">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.preview} alt="" />
                  <button type="button" className="rtray-x" aria-label="Take this picture off"
                          onClick={() => setTray((x) => x.filter((y) => y.path !== t.path))}>×</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className={'ranon' + (anon ? ' on' : '')}
                  aria-pressed={anon} onClick={() => setAnon(!anon)}>
            {anon ? '🤫 replying anonymously' : 'reply anonymously?'}
          </button>
          <form onSubmit={send}>
            {/* 🙂 Emoji, and 📷 pictures — but the camera is ABSENT while
                anonymous, not disabled. An anonymous reply cannot carry a
                photo (comments_anon_no_media), so a greyed-out button
                would be an invitation to work out how to enable something
                that has no answer. Same call the Wall composer makes. */}
            <button type="button" className="remo" aria-label="Open emoji"
                    aria-expanded={emoji} onClick={() => setEmoji((v) => !v)}>🙂</button>
            {!anon && tray.length < 10 && (
              <PhotoUpload kind="comment" className="rpick" label="📷" busyLabel="…"
                           onBusy={setUpBusy}
                           onDone={(path, preview) => setTray((t) => [...t, { path, preview }])} />
            )}
            <input ref={boxRef} value={text} {...tag.inputProps} maxLength={2000}
                   aria-label="Write a reply"
                   placeholder={anon ? 'Nobody will see who wrote this…' : 'Say something… @ to tag'} />
            <button type="submit" disabled={busy || upBusy || (!text.trim() && tray.length === 0)}>
              {busy ? '…' : 'Reply'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
