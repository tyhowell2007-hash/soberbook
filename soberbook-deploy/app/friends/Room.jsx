'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient, assertReadable } from '../../lib/supabase-browser';
import EmojiPicker from './EmojiPicker';
import PhotoUpload from '../components/PhotoUpload';
import MsgMenu from './MsgMenu';

/* =====================================================================
   🛋️ THE FRONT ROOM — everybody, talking, in one place.

   Ty, 29 Aug: "make the community page so that everybody can talk and
   everybody can see the conversation going on... a whole big community
   blog that people can talk to other people, and other people can see
   that. and chime in."

   ⭐ THE UNIT IS A MESSAGE, NOT A POST, AND THAT IS THE ENTIRE BET.
   Eleven of eighteen members have never posted. A Wall post is a small
   performance — you need something worth saying and it sits under your
   name forever. "morning, rough night" is the cheapest sentence in the
   app, and this is the only place to put it.

   ---------------------------------------------------------------------
   ⚠️ READS room_wall, NEVER room_messages. The base table is revoked from
   members outright; the view is where a block gets applied in BOTH
   directions before anything reaches this browser. assertReadable() makes
   that a crash rather than a leak if anybody ever edits this line.

   ⚠️ THE ID IS GENERATED HERE and handed to the database, exactly like
   posts (0061/0062). Members hold INSERT on room_messages and no SELECT,
   so `.insert().select()` would fail — and it failed loudly enough on the
   Wall in August to take posting down for forty minutes. We need to KNOW
   the id, not be TOLD it.
   ===================================================================== */

/* ⚠️ Poll, don't subscribe. A realtime subscription streams the ROW as
   written — author_id included — straight into a browser, and this table
   carries the id of everybody talking. The /admin/numbers page made the
   same call in August for the same reason. Twelve seconds is a
   conversation; it is not a presence signal. */
const POLL_MS = 12000;

const COLS = 'id, body, photo_urls, created_at, is_mine, handle, display_name, display_avatar';

export default function Room({ room, initial, meHandle, members, signed }) {
  const [msgs, setMsgs]   = useState(initial || []);
  const [body, setBody]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [emoji, setEmoji] = useState(false);
  /* Pictures chosen but not sent yet: { path, preview }. The path is
     already a stripped file sitting in room-photos — PhotoUpload finishes
     the whole quarantine round trip before it calls back — so "staged"
     means staged in this form, not staged on a server somewhere. */
  const [tray, setTray]   = useState([]);
  const [upBusy, setUpBusy] = useState(false);
  /* path -> temporary https URL. Seeded from the server render so the
     first screen has its pictures already, then topped up as new
     messages arrive. */
  const [urls, setUrls]   = useState(signed || {});
  const [big, setBig]     = useState(null);
  const boxRef            = useRef(null);
  const stickRef          = useRef(true);
  const inputRef          = useRef(null);

  /* 🔴 A REF, NOT THE STATE, AND THIS IS THE AUG 26 EGRESS BUG WAITING TO
     HAPPEN AGAIN. refresh() runs from a setInterval created once, so it
     closes over whatever `urls` was on the first render — for ever. Ask
     "which of these do I already have?" through that stale copy and the
     answer is always "none", so every poll re-signs every picture in the
     room. Twelve seconds apart. That is how the Wall got to 159% of the
     egress tier on 113MB of files.

     A ref is the same object every render, so what it holds is current
     by the time the timer fires. */
  const urlsRef = useRef(signed || {});
  function addUrls(map) {
    urlsRef.current = { ...urlsRef.current, ...map };
    setUrls(urlsRef.current);
  }

  /* ⚠️ INSERTS AT THE CURSOR, not at the end.
     Somebody typing "one year today and I feel" should be able to drop an
     emoji mid-sentence. Appending is one line shorter and quietly wrong.

     ⚠️ The caret is put back explicitly afterwards. Setting .value on an
     input moves the caret to the end as a side effect, so without this
     every pick would fling you to the end of your own sentence. */
  function insertEmoji(e) {
    const el = inputRef.current;
    if (!el) { setBody((b) => b + e); return; }
    const s = el.selectionStart ?? body.length;
    const t = el.selectionEnd ?? s;
    const next = body.slice(0, s) + e + body.slice(t);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const p = s + e.length;
      try { el.setSelectionRange(p, p); } catch { /* older browsers */ }
    });
  }

  /* Was the reader already at the bottom before new messages arrived?
     ⚠️ Checked BEFORE the list re-renders, because after it there is no
     way to tell "they were reading the newest" from "they had scrolled
     up to read something from this morning" — and yanking somebody away
     from a message they are halfway through is the rudest thing a chat
     can do. */
  function noteStick() {
    const el = boxRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  useEffect(() => {
    if (stickRef.current && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [msgs]);

  /* ⚠️ THE BUCKETS ARE PRIVATE, so a stored path has no working URL of
     its own — it has to be signed. This asks our own route, which asks
     room_wall whether the caller may see each one and signs only what
     comes back. See app/api/photo/sign/route.js: the rule has ONE home
     and it isn't here.

     ⚠️ Only paths we don't already hold. A signed URL is cached in
     Postgres and reused, so asking again for one we have would still
     cost a round trip for an answer we already know — and on Aug 26 the
     equivalent mistake on the Wall burned 159% of the egress tier. */
  async function signMissing(rows) {
    const have = urlsRef.current;
    const want = [];
    for (const m of rows) {
      for (const p of m.photo_urls || []) if (p && !have[p]) want.push(p);
    }
    if (!want.length) return null;
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [...new Set(want)] }),
      });
      const d = await res.json().catch(() => ({}));
      return d.urls || null;
    } catch {
      /* A picture that can't be signed simply doesn't render. The
         conversation still works — the same "fails to no-photos rather
         than to a broken page" stance as signPhotoPaths itself. */
      return null;
    }
  }

  async function refresh() {
    const supabase = browserClient();
    const { data } = await supabase
      .from(assertReadable('room_wall'))
      .select(COLS)
      .eq('room_slug', room.slug)
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) {
      noteStick();
      const rows = data.slice().reverse();
      setMsgs(rows);
      const fresh = await signMissing(rows);
      if (fresh) addUrls(fresh);
    }
  }

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    /* ⚠️ Refresh when the tab comes back to the front. A phone that has
       been in a pocket for an hour would otherwise show an hour-old room
       until the next tick, which reads as "nobody is here." */
    const onShow = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.slug]);

  /* Take one back out of the tray. ⚠️ The file is already uploaded and
     stripped by this point, so removing it here orphans it in the
     bucket — deliberately. The alternative is a delete call the person
     has to wait for while they are still choosing pictures, and the
     orphan sweeper exists precisely so that tidying up is not allowed to
     get in the way of somebody using the app. */
  function unstage(path) {
    setTray((t) => {
      const hit = t.find((x) => x.path === path);
      if (hit?.preview) URL.revokeObjectURL(hit.preview);
      return t.filter((x) => x.path !== path);
    });
  }

  async function send(e) {
    e?.preventDefault();
    const text = body.trim();
    /* ⭐ A PICTURE ON ITS OWN IS A MESSAGE. 0093 dropped the NOT NULL on
       body for exactly this — somebody holding up a nine-month chip does
       not also have to write a caption. The database enforces "body OR
       photos, never neither"; this is the same rule read forwards. */
    if ((!text && tray.length === 0) || busy || upBusy) return;
    setBusy(true); setErr('');

    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Sign in again.'); setBusy(false); return; }

    const id = crypto.randomUUID();

    /* Show it immediately. ⚠️ Optimistic ON PURPOSE here, and deliberately
       NOT for blocking (Aug 6) — the difference is what a wrong guess
       costs. A message that appears and then fails is a visible retry; a
       block that only LOOKS like it worked is dangerous. */
    const paths = tray.map((p) => p.path);

    /* ⚠️ The optimistic copy carries the LOCAL blob previews, keyed by
       path, so your own pictures appear instantly instead of waiting on
       a signing round trip for files you are literally looking at. They
       get replaced by real signed URLs on the next refresh. */
    const local = {};
    tray.forEach((p) => { if (p.preview) local[p.path] = p.preview; });

    const mine = {
      id, body: text || null, photo_urls: paths.length ? paths : null,
      created_at: new Date().toISOString(),
      is_mine: true, handle: meHandle, display_name: 'you', display_avatar: null,
      pending: true,
    };
    noteStick();
    stickRef.current = true;              // you always follow your own message
    if (paths.length) addUrls(local);
    setMsgs((m) => [...m, mine]);
    setBody('');
    setTray([]);
    setEmoji(false);   // sending is finishing; leaving it open hides the room

    const { error } = await supabase
      .from('room_messages')
      .insert({
        id, room_id: room.id, author_id: user.id,
        body: text || null,
        /* ⚠️ null, not [] — room_photo_paths_ok() allows null or 1..100
           entries, and an empty array is neither. Sending [] for a
           text-only message would be refused by the CHECK, which would
           look like "posting is broken" rather than like a bug here. */
        photo_urls: paths.length ? paths : null,
      });

    if (error) {
      setMsgs((m) => m.filter((x) => x.id !== id));
      setBody(text);                      // give them their words back
      /* ⚠️ And their pictures. The files are still in the bucket and the
         paths are still good, so putting the tray back means one tap to
         retry instead of picking six photos again. */
      setTray(tray);
      setErr('That didn’t send. Try again.');
    }
    setBusy(false);
  }

  return (
    <section className="room">
      <div className="roomhead">
        <span className="roomemoji" aria-hidden="true">{room.emoji}</span>
        <span className="roomname">{room.name}</span>
        {/* ⚠️ A COUNT, never a list, and never who is currently here. How
            many people are in the room is a fact about the room; who is in
            it at 11pm is a fact about them — that is the presence-dot
            argument, and it hasn't changed. */}
        {members > 0 && (
          <span className="roomcount">{members} member{members === 1 ? '' : 's'}</span>
        )}
      </div>

      <div className="roombox" ref={boxRef} onScroll={noteStick}>
        {msgs.length === 0 ? (
          /* ⚠️ Names the first thing to say rather than saying "no
             messages yet". An empty room that instructs is an invitation;
             one that reports emptiness is a verdict on the place. */
          <p className="roomempty">Nobody’s said anything yet today. “Morning” counts.</p>
        ) : msgs.map((m) => {
          const pics = (m.photo_urls || []).filter(Boolean);
          return (
          <div key={m.id} className={'rmsg' + (m.is_mine ? ' mine' : '') + (m.pending ? ' pending' : '')}>
            {!m.is_mine && <div className="rwho">{m.display_name}</div>}
            <div className="rline">
              <div className="rbub">
                {pics.length > 0 && (
                  /* ⚠️ `n2` / `n3` rather than a count in a style
                     attribute — two pictures side by side and six in a
                     grid are different shapes, and CSS should decide
                     which, not JavaScript. */
                  <div className={'rpics' + (pics.length === 1 ? ' one'
                                          : pics.length === 2 ? ' two' : ' many')}>
                    {pics.map((p) => (
                      <button key={p} type="button" className="rpic"
                              aria-label="Open this picture"
                              onClick={() => urls[p] && setBig(urls[p])}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urls[p] || ''} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                {m.body && <span className="rtext">{m.body}</span>}
              </div>
              {/* ⚠️ OUTSIDE the bubble, never inside it — a <button>
                  nested in a <button> is invalid HTML and browsers
                  recover from it differently. Same rule as RowMenu.
                  Hidden on a message still in flight: there is nothing on
                  the server yet to delete or report. */}
              {!m.pending && (
                <MsgMenu id={m.id} mine={m.is_mine} name={m.display_name}
                         onGone={(gid) => setMsgs((all) => all.filter((x) => x.id !== gid))} />
              )}
            </div>
          </div>
          );
        })}
      </div>

      {err && <div className="err">{err}</div>}

      {/* What you've picked but not sent. ⚠️ Above the bar and below the
          conversation, so it never covers what somebody is replying to. */}
      {/* ⚠️ The progress line lives out here, not on the button. A 44px
          circle cannot hold the word "Uploading" — and a big photo on a
          slow phone takes real seconds, so silence would read as a dead
          button. */}
      {upBusy && <p className="roomempty" role="status">Adding a picture…</p>}

      {tray.length > 0 && (
        <div className="rtray" aria-label={`${tray.length} picture${tray.length === 1 ? '' : 's'} ready to send`}>
          {tray.map((p) => (
            <div key={p.path} className="rtray-one">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" />
              <button type="button" className="rtray-x"
                      aria-label="Take this picture off" onClick={() => unstage(p.path)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Full size. ⚠️ A plain overlay, not a new tab — a signed URL in
          the address bar is a link somebody can copy and paste, and it
          keeps working for an hour in anybody's browser. */}
      {big && (
        <div className="rbig" role="dialog" aria-modal="true" onClick={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="" />
          <button type="button" className="rbig-x" aria-label="Close">Close</button>
        </div>
      )}

      {/* Above the bar, so picking one never covers the conversation. */}
      <EmojiPicker open={emoji} onClose={() => setEmoji(false)} onPick={insertEmoji} />

      <form className="rbar" onSubmit={send}>
        {/* ⚠️ type="button" — inside a <form>, a button with no type is a
            SUBMIT button, so opening the picker would have sent the
            message instead. */}
        <button type="button" className="remo"
                aria-expanded={emoji} aria-label="Open emoji"
                onClick={() => setEmoji((v) => !v)}>
          🙂
        </button>
        {/* ⚠️ THE SAME PhotoUpload THE WALL USES, with kind="room". Not a
            second uploader — one quarantine road, one metadata strip, one
            place where a photo stops being dangerous. A room-only copy
            would be a second implementation of the safety story, and the
            second copy is always the one that drifts. */}
        <PhotoUpload
          kind="room"
          label="🖼️"
          busyLabel="…"
          className="rpick"
          onBusy={setUpBusy}
          onDone={(path, preview) => setTray((t) => [...t, { path, preview }])}
        />
        <input
          ref={inputRef}
          className="rin"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Say something…"
          maxLength={2000}
          aria-label="Say something in The Front Room"
        />
        {/* ⚠️ Disabled only while empty or sending — never left dead with
            no explanation. The /welcome submit button taught us that. */}
        {/* ⚠️ Live while there is text OR a picture — and dead while an
            upload is still running, so nobody sends a message a beat
            before its photo finishes and loses it. */}
        <button className="rgo" type="submit"
                disabled={busy || upBusy || (!body.trim() && tray.length === 0)}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
