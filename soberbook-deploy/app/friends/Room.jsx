'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { browserClient, assertReadable } from '../../lib/supabase-browser';
import EmojiPicker from './EmojiPicker';
import PhotoUpload from '../components/PhotoUpload';
import MsgMenu from './MsgMenu';
import { Body } from '../components/Linked';
import { useTagBox, useTaggablePeople, tellThemTheyWereTagged } from '../components/TagBox';
import Shot from '../components/Shot';

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

const COLS = 'id, body, photo_urls, edited_at, created_at, is_mine, handle, display_name, display_avatar, likes, i_liked';

export default function Room({ room, initial, meHandle, members, signed, spokenHere = true }) {
  /* ⚠️ `initial === null` means nobody has fetched this room yet (see
     RoomSwitch), which is a different thing from "this room is empty".
     Conflating them would render a permanent empty state on any room the
     server didn't preload. */
  const preloaded = Array.isArray(initial);
  const [msgs, setMsgs]   = useState(preloaded ? initial : []);
  const [loaded, setLoaded] = useState(preloaded);
  const [body, setBody]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [emoji, setEmoji] = useState(false);

  /* Pictures chosen but not sent yet: { path, preview }. The path is
     already a stripped file sitting in room-photos — PhotoUpload finishes
     the whole quarantine round trip before it calls back — so "staged"
     means staged in this form, not staged on a server somewhere. */
  const [tray, setTray]   = useState([]);
  /* One video, or none. ⚠️ Its own slot rather than a flag inside `tray`,
     because the send path wants a single column and the tray is an
     array — keeping them separate means no filtering at the one moment
     that has to be right. */
  const [vid, setVid]     = useState(null);
  const [upBusy, setUpBusy] = useState(false);
  /* path -> temporary https URL. Seeded from the server render so the
     first screen has its pictures already, then topped up as new
     messages arrive. */
  const [urls, setUrls]   = useState(signed || {});
  const [big, setBig]     = useState(null);
  /* ⚠️ Seeded from the server, then turned off locally the moment they
     send. Waiting for the next poll to hide it would leave a line saying
     "you don't have to write anything clever" sitting directly under the
     thing they just wrote. */
  /* ⚠️ `spokenHere === null` means the server didn't check for this room.
     Start with the nudge OFF and let refresh() decide — showing it and
     then snatching it away a second later would be worse than a beat's
     delay. */
  const [showNudge, setShowNudge] = useState(spokenHere === false);
  /* Which message is open for editing, and the words as they stand. */
  const [editId, setEditId] = useState(null);
  const [draft, setDraft]   = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const taRef             = useRef(null);
  const boxRef            = useRef(null);
  const stickRef          = useRef(true);
  const inputRef          = useRef(null);

  /* ---- tagging in a room (5 Sept) ----
     Ty: "Any room we have that you can type to somebody, they should be
     able to tag somebody."

     ⚠️ ALWAYS ENABLED, INCLUDING IN THE ANONYMOUS ROOMS, and that is not
     an oversight. Your handle is already hidden in here — room_wall nulls
     it and hands out a per-room alias — so naming SOMEBODY ELSE says
     nothing about you. And 0131 reads actor_anon off room.anonymous, so
     the notification the tag produces says "Someone", never your name.
     Anonymity survives the tag on both ends. */
  const people = useTaggablePeople();
  const tag = useTagBox({ text: body, setText: setBody, boxRef: inputRef, people });

  /* 🔴 THIS BLOCK SITS BELOW inputRef ON PURPOSE, AND IT IS NOT STYLE.
     It was first written up with the other useState calls, ~30 lines
     ABOVE the ref — and `const` is hoisted but not initialised, so
     reading inputRef there throws "Cannot access 'inputRef' before
     initialization" and white-screens this whole page for every member.

     ⚠️ esbuild parsed it clean. A temporal dead zone is a RUNTIME error,
     so the build is green and the page is dead — the 2 Sept lesson
     ("a green build proves it compiles, not that the page opens")
     arriving from a new direction. Do not move this back up. */

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
  /* ⚠️ The local copy of this was DELETED, not left alongside the shared
     one — 0049's lesson: the fix is to remove a copy, not to update it.
     tag.insertEmoji owns the caret because the tag menu already does. */
  const insertEmoji = tag.insertEmoji;


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
      /* 🔴 ASK FOR THE VIDEO TOO. A path nobody asks to sign is a path
         that never gets a URL — the video would upload, save, and render
         as an empty player with no error anywhere. Same silent shape as
         the 0065 bug where photos 2-10 were never collected. */
      if (m.video_url && !have[m.video_url]) want.push(m.video_url);
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
      setLoaded(true);
      /* Work out the nudge from the answer when the server didn't check
         this room for us — `is_mine` is on every row, so the question
         "have I ever spoken here" is already answered by what came back.
         ⚠️ Only on the FIRST load: after that the local setShowNudge(false)
         on send is the truth, and re-deriving it would make the line
         flicker back for one poll after somebody speaks. */
      if (spokenHere === null && !loaded) {
        setShowNudge(!rows.some((m) => m.is_mine));
      }
      const fresh = await signMissing(rows);
      if (fresh) addUrls(fresh);
    }
  }

  useEffect(() => {
    /* A room the server didn't preload has nothing on screen, so it is
       fetched immediately rather than after the first twelve-second tick.
       ⚠️ Twelve seconds of a blank room is how somebody decides the place
       is dead and closes the tab. */
    if (!preloaded) refresh();
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

  /* ---------------------------------------------------------------
     EDITING YOUR OWN WORDS (0096)

     🔴 NOT OPTIMISTIC, and this is the opposite call to the one made for
     sending. A message that appears and then fails is a visible retry —
     you can see it didn't land. An EDIT that appears to have saved and
     hasn't leaves you believing the room is reading words it never got,
     which is closer to the block case than the message case. It's one
     round trip on a deliberate action, with the field right there.
     --------------------------------------------------------------- */
  /* =====================================================================
     TOGGLE A HEART.

     ⚠️ THE SERVER'S ANSWER OVERWRITES THE GUESS, it doesn't just confirm
     it. `room_like` returns the real count after the write, so if two
     people heart the same message in the same second this lands on the
     true number instead of on our own +1. Guessing and then never
     checking is how a count drifts and nobody notices for a week.

     ⚠️ On failure the row goes back exactly as it was. The database
     refuses hearting your own message and anything you can't see, so a
     refusal here is a real answer, not a glitch to paper over. */
  async function heart(id) {
    const before = msgs.find((x) => x.id === id);
    if (!before) return;

    setMsgs((all) => all.map((x) => x.id === id
      ? { ...x, i_liked: !x.i_liked, likes: (x.likes || 0) + (x.i_liked ? -1 : 1) }
      : x));

    const { data, error } = await browserClient().rpc('room_like', { m_id: id });
    const row = Array.isArray(data) ? data[0] : data;

    setMsgs((all) => all.map((x) => x.id === id
      ? (error || !row
          ? { ...x, i_liked: before.i_liked, likes: before.likes }
          : { ...x, i_liked: row.liked, likes: row.likes })
      : x));
  }

  function startEdit(id) {
    const m = msgs.find((x) => x.id === id);
    if (!m) return;
    setErr('');
    setEditId(id);
    setDraft(m.body || '');
    /* ⚠️ Caret at the END, not the start. Setting a textarea's value puts
       it at position 0, which drops you in front of your own sentence. */
    setTimeout(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* older */ }
    }, 0);
  }

  function cancelEdit() { setEditId(null); setDraft(''); setSavingEdit(false); }

  async function saveEdit() {
    const m = msgs.find((x) => x.id === editId);
    if (!m || savingEdit) return;
    const next = draft.trim();
    const hasPics = (m.photo_urls || []).length > 0;
    /* Guarded here AND in the database. This copy exists to explain; the
       one in edit_my_room_message() is the one that enforces. */
    if (next === (m.body || '')) return;
    if (!next && !hasPics) return;

    setSavingEdit(true); setErr('');
    const { data, error } = await browserClient()
      .rpc('edit_my_room_message', { msg_id: editId, new_body: next });
    setSavingEdit(false);

    /* ⚠️ The function returns FALSE rather than erroring when the message
       isn't yours or is already gone. That is not an error to forward —
       it means there is nothing here to change. */
    if (error || data === false) {
      setErr(error ? 'That didn’t save. Try again.' : 'That message is gone.');
      return;
    }
    setMsgs((all) => all.map((x) => (
      x.id === editId ? { ...x, body: next || null, edited_at: new Date().toISOString() } : x
    )));
    cancelEdit();
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
    /* ⚠️ Read BEFORE setBody('') a few lines down. Once the composer is
       cleared the text is gone, and with it every name in it. */
    const named = tag.handles;

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
      video_url: vid ? vid.path : null,
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
    setVid(null);
    setShowNudge(false);   // they've spoken; the invitation has done its job
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
        video_url: vid ? vid.path : null,
      });

    if (!error) {
      /* ⚠️ Only on success, and never awaited into the failure path. The
         message is already on the wall by the time this runs; a
         notification that doesn't fire must not be able to make a sent
         message look unsent. */
      tellThemTheyWereTagged('room', id, named);
    }

    if (error) {
      setMsgs((m) => m.filter((x) => x.id !== id));
      setBody(text);                      // give them their words back
      /* ⚠️ And their pictures. The files are still in the bucket and the
         paths are still good, so putting the tray back means one tap to
         retry instead of picking six photos again. */
      setTray(tray);
      setVid(vid);                        // and their video
      setErr('That didn’t send. Try again.');
    }
    setBusy(false);
  }

  return (
    /* ⚠️ Keyed off the SLUG, not off room.anonymous. The porch photograph
       belongs to one specific room; anonymity is a separate property that
       a future room might also have without wanting this background. Two
       different facts, two different switches. */
    <section className={'room' + (room.slug === 'front-porch' ? ' rporch' : '')}>
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

      {/* 🔴 THE BLURB IS NOT DECORATION IN AN ANONYMOUS ROOM. Somebody
          arriving from the Front Room will assume their handle is showing,
          because it always has been everywhere else in this app. Being
          wrong about that — saying something about your husband under
          your own name because you didn't know the rules had changed — is
          the exact harm the room was built to prevent. It is shown ALWAYS
          for a room that hides names, never collapsed, never dismissible. */}
      {room.blurb && (
        <p className={'roomblurb' + (room.anonymous ? ' hush' : '')}>
          {room.anonymous && <span aria-hidden="true">🕶️ </span>}
          {room.blurb}
        </p>
      )}

      {/* 🔴 THE WAY IN TO THE PHONE NUMBERS, AND IT IS THE POINT OF THIS
          LINE EXISTING AT ALL. Ten times this month something has been
          fully built with no way to reach it — delete-your-own-post, the
          sign-out, the hide button, reports.target_type='profile'. A help
          page nobody can find is the eleventh.

          ⚠️ It sits in the ROOM, above the conversation, not buried in a
          menu. Somebody who needs a crisis line is not going to go
          looking for it, and the moment they need it is the moment they
          have least patience for hunting.

          ⚠️ Shown on every room, not just the Porch. 988 is not a
          family-only number. */}
      <p className="roomhelp">
        <Link href="/help">If you need somebody right now ›</Link>
      </p>

      <div className="roombox" ref={boxRef} onScroll={noteStick}>
        {!loaded ? (
          /* ⚠️ Says it's fetching rather than showing the empty state.
             "Nobody's said anything yet" while we simply haven't looked is
             a lie, and in this room specifically it is a discouraging one. */
          <p className="roomempty">Opening the room…</p>
        ) : msgs.length === 0 ? (
          /* ⚠️ Names the first thing to say rather than saying "no
             messages yet". An empty room that instructs is an invitation;
             one that reports emptiness is a verdict on the place. */
          <p className="roomempty">Nobody’s said anything yet today. “Morning” counts.</p>
        ) : msgs.map((m) => {
          const pics = (m.photo_urls || []).filter(Boolean);

          /* ⭐ THE BUBBLE BECOMES THE FIELD, in place. Ty picked this over
             editing inside the ⋯ sheet, and the reason is that the room
             is a conversation: while you are fixing a sentence you need
             to see what came before and after it. The sheet would cover
             exactly that. */
          if (editId === m.id) {
            const next    = draft.trim();
            const unchanged = next === (m.body || '');
            const empty     = !next && pics.length === 0;
            return (
              <div key={m.id} className="rmsg mine">
                <div className="redit">
                  {/* The pictures stay put and are not editable — swapping
                      the image under a message people have already seen
                      is a different problem from fixing a typo. The video
                      is here for the same reason: hiding it while you fix
                      a typo makes it look like editing deleted it. */}
                  {m.video_url && urls[m.video_url] && (
                    <video className="rvid" src={urls[m.video_url]}
                           controls playsInline preload="metadata" />
                  )}
                  {pics.length > 0 && (
                    <div className={'rpics' + (pics.length === 1 ? ' one'
                                            : pics.length === 2 ? ' two' : ' many')}>
                      {pics.map((p) => (
                        <span key={p} className="rpic">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urls[p] || ''} alt="" />
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={taRef}
                    className="rta"
                    rows={3}
                    value={draft}
                    maxLength={2000}
                    aria-label="Edit your message"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      /* Escape gets you out. A field you can only leave by
                         finding the right button is a trap — same rule as
                         the emoji picker and the Thread modal. */
                      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                    }}
                  />
                  <div className="rerow">
                    {/* ⚠️ Says WHY the button is dead. A control that is
                        greyed out with no explanation is the /welcome
                        submit button all over again. */}
                    <span className="rcnt">
                      {empty ? 'A message needs words or a picture'
                             : unchanged ? 'No changes yet' : ''}
                    </span>
                    <button type="button" className="lnk" onClick={cancelEdit}>Cancel</button>
                    <button type="button" className="rgo" disabled={savingEdit || unchanged || empty}
                            onClick={saveEdit}>
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

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
                        <Shot path={p} src={urls[p]} alt=""
                              onFixed={(k, u) => addUrls({ [k]: u })} />
                      </button>
                    ))}
                  </div>
                )}
                {/* 🎬 A VIDEO IN THE ROOM (0133).
                    ⚠️ preload="metadata", never "auto" — "auto" pulls the
                    whole file for every video on screen on every load.
                    ⚠️ And nothing autoplays: a room is a conversation,
                    and a video here is often somebody talking about the
                    worst thing that happened to them. It must not start
                    playing to a room because a thumb moved. */}
                {m.video_url && urls[m.video_url] && (
                  <video className="rvid" src={urls[m.video_url]}
                         controls playsInline preload="metadata" />
                )}
                {m.body && <span className="rtext"><Body text={m.body} tags={people} /></span>}
                {/* 🔴 SHOWN TO EVERYONE, not just the author. Without it,
                    editing is a way to change what you appear to have
                    said after somebody has already answered you. Four
                    grey characters, and they are the whole reason edit is
                    safe to offer at all. */}
                {m.edited_at && <span className="redited"> · edited</span>}
              </div>
              {/* ⚠️ OUTSIDE the bubble, never inside it — a <button>
                  nested in a <button> is invalid HTML and browsers
                  recover from it differently. Same rule as RowMenu.
                  Hidden on a message still in flight: there is nothing on
                  the server yet to delete or report. */}
              {/* =====================================================
                  ♥ A HEART, AND THE RULE IS THAT IT NEVER SHOWS A ZERO.

                  Ty, 3 Sept: "in all chat rooms, I want you to be able to
                  like other people's comments underneath yours."

                  ⭐ SOMEBODY ELSE'S MESSAGE ALWAYS GETS THE OUTLINE, so
                  the way to answer without words is visible even on a
                  message nobody has answered yet. The NUMBER only appears
                  once it is at least one — there is no "0" anywhere on
                  this screen to feel bad about, the same rule the
                  open-room card follows.

                  ⭐ YOUR OWN MESSAGE GETS NO BUTTON, only the count, and
                  only if somebody hearted it. So a message of yours that
                  nobody answered looks exactly like a message of yours —
                  not like a message of yours with a zero beside it.

                  ⚠️ Optimistic, unlike Block. A heart that appears and
                  then fails is a visible retry; the database refuses what
                  it must refuse, so the worst case is a heart that pops
                  back off. Block waits, because a block that only LOOKS
                  like it worked is dangerous — this isn't that.

                  ⚠️ Hidden while a message is still in flight: there is
                  no row on the server yet to heart. */}
              {!m.pending && !m.is_mine && (
                <button type="button"
                        className={'rheart' + (m.i_liked ? ' on' : '')}
                        aria-pressed={!!m.i_liked}
                        aria-label={m.i_liked ? 'Take your heart back' : 'Heart this'}
                        onClick={() => heart(m.id)}>
                  <span aria-hidden="true">{m.i_liked ? '♥' : '♡'}</span>
                  {m.likes > 0 && <span className="rheartn">{m.likes}</span>}
                </button>
              )}
              {!m.pending && m.is_mine && m.likes > 0 && (
                <span className="rheart on mine" aria-label={`${m.likes} hearted this`}>
                  <span aria-hidden="true">♥</span>
                  <span className="rheartn">{m.likes}</span>
                </span>
              )}
              {!m.pending && (
                <MsgMenu id={m.id} mine={m.is_mine} name={m.display_name}
                         onEdit={startEdit}
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
          {vid && (
            <div className="rtray-one">
              {/* ⚠️ controls + preload="metadata". Nothing autoplays in a
                  room — the Wall's note says why, and it is stronger
                  here: a room is a conversation, not a feed. */}
              <video src={vid.preview} controls playsInline preload="metadata" />
              <button type="button" className="rtray-x"
                      aria-label="Take the video off"
                      onClick={() => setVid(null)}>×</button>
            </div>
          )}
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

      {/* =====================================================================
          🔴 WARN BEFORE A PICTURE GOES INTO AN ANONYMOUS ROOM. 3 Sept.

          Ty was offered "block it", "allow it", and "allow, but warn first"
          and picked the third. Only the ALLOW half got built — the picker
          shipped into two anonymous rooms with nothing anywhere saying a
          photo can undo the thing those rooms exist to do.

          ⭐ WHY IT HANGS OFF THE TRAY AND NOT OFF THE PICKER. A line that
          is always above the composer is wallpaper by somebody's second
          visit — the same way nobody read "we're opening soon" on a live
          landing page for a month. This appears only while a picture is
          actually staged, which is the one moment the sentence is about
          something, and the ✕ that takes it back out is directly above it.

          ⚠️ AND THE TRAY REALLY IS THE LAST SAFE MOMENT. By the time a
          thumbnail is here the file is uploaded and stripped, but it sits
          in a PRIVATE bucket attached to no message — unstaging orphans it
          and the sweeper takes it. Nothing is visible to another member
          until Send. So warning here costs nobody anything and still lands
          before the only irreversible step.

          ⚠️ `room.anonymous`, never the slug. The porch photograph is keyed
          off the slug because it belongs to one specific room; anonymity is
          a property, and keying this off a slug list would mean the fourth
          anonymous room silently ships without the warning.

          ⚠️ It does NOT block and it does NOT need dismissing. He said warn,
          not gate. A confirm dialog here gets click-throughed within a week
          and then it is worse than nothing, because we would believe people
          had read it.

          ⚠️ The second sentence is the load-bearing one. The photo somebody
          thinks about is the selfie. The one that actually identifies them
          is the prescription label on the counter, the street sign through
          the window, the kid's drawing on the fridge. */}
      {room.anonymous && tray.length > 0 && (
        <p className="rshade">
          <span aria-hidden="true">🕶️ </span>
          Your name is hidden in here. A photo isn’t — check for faces, and
          anything behind them.
        </p>
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

      {/* ⭐ THE INVITATION, and it is the only thing on this page aimed at
          somebody who has not spoken yet.

          30 Aug: 60 of 80 members had never said one word anywhere in the
          app. Signup now lands here instead of the Wall — but arriving in
          a conversation you have never joined is still a moment where
          most people read and leave. This names the smallest acceptable
          thing to say, so nobody has to work out for themselves whether
          "morning" is allowed.

          ⚠️ It never appears for somebody who has spoken here before, and
          it goes the instant they send. A permanent version would be a
          nag, and worse, it would read as the room telling a quiet member
          they are doing it wrong.

          ⚠️ Deliberately NOT a prefilled message. Putting words in
          somebody's mouth is a different thing from telling them a short
          one is fine — and in a room where the whole promise is that
          nobody has to perform, a draft written by the app is the wrong
          kind of help. */}
      {showNudge && msgs.length > 0 && (
        <p className="rnudge">
          You don’t have to write anything clever. “Morning” counts.
        </p>
      )}

      {/* Above the bar, so picking one never covers the conversation. */}
      {/* ⚠️ skin="green" — this is the one caller on a dark page. The
          panel's dark palette used to come from friends.css; it now comes
          from asking for it, so it cannot be lost by a stylesheet that
          did not load. Nothing about how this looks has changed. */}
      <EmojiPicker open={emoji} onClose={() => setEmoji(false)} onPick={insertEmoji}
                   skin="green" />

      {/* ⚠️ ABOVE the bar. This composer is pinned to the bottom of the
          screen, so a menu rendered under it opens off-screen behind the
          keyboard. The Wall puts the same menu below its own composer
          because that one sits at the TOP of the page. */}
      {tag.menu}

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
          /* 🎬 VIDEO TOO (0133). ONE button, not a second one beside it —
             the Wall's note argues this and it holds here: two controls
             doing one job on the narrowest row in the app forces a
             decision the file picker is about to ask anyway.

             ⚠️ Narrowed once a video is staged: one video per message,
             so offering a second means uploading a file we are about to
             refuse. Cheaper not to offer it.

             🔴 In an ANONYMOUS room the picker stays images-only. The
             database refuses the write either way (room_video_guard), but
             letting somebody choose a video, wait for the upload and THEN
             be refused is the worst version of a rule. Say no before the
             work, not after. */
          accept={room.anonymous ? 'image/*'
                  : vid ? 'image/*' : 'image/*,video/mp4,video/quicktime'}
          label="🖼️"
          busyLabel="…"
          className="rpick"
          onBusy={setUpBusy}
          onDone={(path, preview, isVideo) => {
            if (isVideo) setVid({ path, preview });
            else setTray((t) => [...t, { path, preview }]);
          }}
        />
        <input
          ref={inputRef}
          className="rin"
          value={body}
          {...tag.inputProps}
          placeholder="Say something… @ to tag"
          maxLength={2000}
          aria-label="Say something in The Front Room"
        />
        {/* ⚠️ Disabled only while empty or sending — never left dead with
            no explanation. The /welcome submit button taught us that. */}
        {/* ⚠️ Live while there is text OR a picture — and dead while an
            upload is still running, so nobody sends a message a beat
            before its photo finishes and loses it. */}
        <button className="rgo" type="submit"
                disabled={busy || upBusy || (!body.trim() && tray.length === 0 && !vid)}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
