'use client';

import { useEffect, useRef, useState } from 'react';
/* ⚠️ Added 8 Sept with the reply author link. esbuild parses one file at a
   time and never resolves imports, so a <Link> used without this line
   passes the parse check and crashes at runtime — three missing imports
   got through exactly that way on 30 Aug. */
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import { Body, Player } from '../components/Linked';
import { useTagBox, useTaggablePeople, tellThemTheyWereTagged } from '../components/TagBox';
import { saysHighlight } from '../../lib/mentions';
import PhotoUpload from '../components/PhotoUpload';
import EmojiPicker from '../friends/EmojiPicker';
import ReplyMenu from './ReplyMenu';
import Shot from '../components/Shot';

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
  const [hearting, setHearting] = useState(() => new Set());

  /* ⭐ A HEART ON A REPLY. Ty's ask, 7 Sept.

     ⚠️ THIS REVERSES A DELIBERATE REFUSAL, and it is safe for the same
     reason the room hearts were (0129): the danger the original note
     named was RANKING — a heart deciding what floats up and burying
     whoever answered quietly at 3am. This list is chronological, and the
     wall shows the LAST two replies, not the top ones. There is no order
     for a heart to corrupt.

     🔴 SILENT. No notification, unlike Support/Strength. Those say
     something specific; a heart does not, which is why 0025 said "likes
     are not a kind" and why that still stands. */
  async function heartReply(c) {
    if (hearting.has(c.id)) return;
    const nowOn = !c.liked_by_me;
    setHearting((s) => new Set(s).add(c.id));
    setRows((list) => (list || []).map((x) => (x.id === c.id
      ? { ...x, liked_by_me: nowOn, like_count: (x.like_count || 0) + (nowOn ? 1 : -1) }
      : x)));
    try {
      const { error } = await supabase.rpc('like_comment', { p_comment: c.id });
      if (error) throw error;
    } catch (e) {
      setRows((list) => (list || []).map((x) => (x.id === c.id
        ? { ...x, liked_by_me: !nowOn, like_count: (x.like_count || 0) + (nowOn ? -1 : 1) }
        : x)));
    } finally {
      setHearting((s) => { const n = new Set(s); n.delete(c.id); return n; });
    }
  }

  /* ---- tagging in a reply (5 Sept) ----
     ⚠️ enabled is `!anon`, exactly as on the Wall. An anonymous reply CAN
     carry a mention — unlike an anonymous post, which mentions_guard
     refuses outright — but offering the menu while anonymous invites
     somebody to think about who they are naming at the same moment they
     are trying not to be named. The @ still works if they type it. */
  const boxRef = useRef(null);
  const people = useTaggablePeople();
  /* ⚠️ canHighlight is `!anon`, not `true`. An announcement carries your
     handle to every member, so an anonymous reply cannot make one — the
     database refuses it and the strip must agree, or the menu offers a
     button that is going to be turned down. Same call the Wall makes. */
  const tag = useTagBox({ text, setText, boxRef, people, enabled: !anon, canHighlight: !anon });
  /* Pictures staged for this reply, and the emoji sheet. */
  const [tray, setTray] = useState([]);
  const [upBusy, setUpBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [urls, setUrls] = useState({});     // path -> signed link
  /* Which replies actually reached everybody — the DATABASE's answer, not
     the text's. See the note by the fetch in load(). */
  const [didBroadcast, setDidBroadcast] = useState(new Set());

  async function load() {
    const { data, error } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);

    /* 🔴 ASK THE DATABASE WHICH REPLIES BROADCAST — never re-read the text.
       saysHighlight() answers "did somebody ASK for it", which is a
       different question and the one that made today so confusing: the word
       sat in Ty's reply looking exactly like the ones that had worked.
       comments_that_broadcast() (0141) answers "did it HAPPEN", and it is
       the only thing allowed to draw the pill. Same rule 0139 set for posts.

       ⚠️ Swallowed on failure — a missing pill is cosmetic, a thread that
       won't open is not. */
    try {
      const ids = (data || []).map((c) => c.id);
      if (ids.length) {
        const { data: hl } = await supabase.rpc('comments_that_broadcast', { p_ids: ids });
        setDidBroadcast(new Set((hl || []).map((r) => (typeof r === 'string' ? r : r.id))));
      }
    } catch { /* no pill, still a thread */ }

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

  /* ⚠️ The local reSign() was DELETED, not left alongside — <Shot> owns
     the one-retry rule now, and 0049's lesson is that the fix is to
     remove a copy rather than update it. */

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

      /* 🔴 @highlight FROM A REPLY — 6 Sept, and it never worked here before.
         Ty typed it into this box three times today and got silence every
         time: no broadcast, no pill, no error. The word was only ever wired
         to the Wall composer, while THIS box says "Say something… @ to tag"
         and looks like it should take it.

         ⚠️ saysHighlight is imported from lib/mentions — the same function
         Wall.jsx asks and the same string Linked.jsx draws the pill from.
         Three callers, one rule. A local copy here is exactly how the
         0046→0049 drift happened and it would be worse than silence: the
         reply would broadcast to 224 people while the thread showed nothing.

         ⚠️ `!anon` mirrors the database, which refuses an anonymous
         broadcast outright. Asking and being refused is worse than not
         asking, so the client doesn't ask. */
      if (!anon && saysHighlight(body || '')) {
        const { data: reached, error: hErr } =
          await supabase.rpc('highlight_comment', { p_comment_id: commentId });
        /* ⭐ AND IT SAYS SO EITHER WAY. The real fault today was not the
           regex — it was that nothing on screen ever said whether the
           announcement went out. Silence is what cost three attempts. */
        if (hErr) setErr(`Replied. ${hErr.message}`);
        else if (reached > 0) setErr(`Replied, and everybody was told — ${reached} members.`);
      }

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
                {/* 🔴 A REPLY LEADS SOMEWHERE NOW (8 Sept, with 0154).
                    Until tonight the person who answered you was plain
                    text — and replies are where most of the talking in
                    this app actually happens, so the busiest surface was
                    the one with no way to the person on it.

                    ⚠️ `author_handle` DID NOT EXIST on feed_comments until
                    0154; the view returned author_id and no handle, so
                    there was nothing here to build a link out of. The new
                    column copies feed_posts' rule word for word rather
                    than restating it.

                    ⚠️ Anonymous replies fall through to plain text, which
                    is the same behaviour as before — the handle is NULL
                    by construction, not hidden by this markup. */}
                {c.author_handle ? (
                  <Link href={`/u/${c.author_handle}`} className="wholink">
                    {c.display_name}
                  </Link>
                ) : c.display_name}
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
                {/* 🔴 NEVER A ZERO, and no button at all on your own reply
                    — like_comment() refuses it, and a heart you cannot
                    press next to your own words is just clutter. On
                    somebody else's the outline always shows, so the
                    wordless answer is available even where nobody has
                    used it yet; the NUMBER only appears at one or more.
                    Same rule as the room hearts and the open-room card. */}
                {!c.is_mine && (
                  <button type="button"
                          className={'cheart' + (c.liked_by_me ? ' on' : '')}
                          aria-pressed={!!c.liked_by_me}
                          aria-label={c.liked_by_me ? 'Undo heart' : 'Heart this reply'}
                          onClick={() => heartReply(c)}>
                    {c.liked_by_me ? '♥' : '♡'}
                    {c.like_count > 0 ? ` ${c.like_count}` : ''}
                  </button>
                )}
                {c.is_mine && c.like_count > 0 && (
                  <span className="cheart cheartmine">♥ {c.like_count}</span>
                )}
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
                  {(c.photo_urls || []).filter(Boolean).map((p) => (
                    <Shot key={p} path={p} src={urls[p]} alt="" className="rpic"
                          onFixed={(k, u) => setUrls((m) => ({ ...m, [k]: u }))} />
                  ))}
                </div>
              )}
              {c.body && <p className="rbody"><Body text={c.body} tags={people} hl={didBroadcast.has(c.id)} /></p>}
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
          {/* ⭐ THE CONFIRMATION, 7 Sept. The Wall composer has shown this
              chip since 5 Sept; the reply box showed nothing, so you typed
              @highlight and had no sign it had registered until after you
              pressed Reply — and for three days it hadn't registered at
              all. Now the word says so while you are still writing.
              ⚠️ It is a claim about INTENT ("this will go to everybody"),
              not about outcome. Whether it actually went out is answered
              afterwards by the pill on the posted reply, which comes from
              the database (0141) and never from the text. */}
          {tag.highlighting && (
            <div className="athlnote">@highlight · everybody</div>
          )}
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
            {/* 📝 12 Sept — THE REPLY BOX, same fix as the Wall composer.
                This is the "join in" box, and it had the identical bug: an
                <input> holding up to 2,000 characters, which does not wrap
                — text scrolls sideways out of view and you cannot read
                back what you wrote.
                ⭐ Ty found it by testing HERE after the Wall was fixed, and
                reported "it didn't work" — he was right, just about a
                different box. The Wall was fine; this one was untouched.
                ⚠️ onInput comes AFTER the {...tag.inputProps} spread on
                purpose. The spread carries the @menu's own onChange and
                onKeyDown; putting the grow on a DIFFERENT event means it
                cannot clobber them or be clobbered by them.
                ⚠️ height:'auto' before reading scrollHeight, or the box can
                only ever get taller — scrollHeight of an already-tall box
                includes the height we set last time. */}
            <textarea ref={boxRef} value={text} {...tag.inputProps} maxLength={2000}
                   rows={2} className="cbox"
                   /* 🔴 NO CAP HERE — `max-height` in wall.css is the only
                      place the ceiling is written. A number in both files is
                      two copies of one rule, and they drift (proved the same
                      night: the CSS said 375px, the JS said 150, the box
                      obeyed the JS). */
                   /* ⚠️ The border is added back because box-sizing is
                      border-box: `height` sets the outer box, scrollHeight
                      reports the content, so without this the border clips
                      the last line. Read from computed style, never a
                      hardcoded 6. Same as the Wall composer. */
                   onInput={(e) => {
                     e.target.style.height = 'auto';
                     const bs = getComputedStyle(e.target);
                     const edge = parseFloat(bs.borderTopWidth) + parseFloat(bs.borderBottomWidth);
                     e.target.style.height = (e.target.scrollHeight + edge) + 'px';
                   }}
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
