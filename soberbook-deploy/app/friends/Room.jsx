'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient, assertReadable } from '../../lib/supabase-browser';
import EmojiPicker from './EmojiPicker';

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

export default function Room({ room, initial, meHandle, members }) {
  const [msgs, setMsgs]   = useState(initial || []);
  const [body, setBody]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [emoji, setEmoji] = useState(false);
  const boxRef            = useRef(null);
  const stickRef          = useRef(true);
  const inputRef          = useRef(null);

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

  async function refresh() {
    const supabase = browserClient();
    const { data } = await supabase
      .from(assertReadable('room_wall'))
      .select('id, body, created_at, is_mine, handle, display_name, display_avatar')
      .eq('room_slug', room.slug)
      .order('created_at', { ascending: false })
      .limit(60);
    if (data) {
      noteStick();
      setMsgs(data.slice().reverse());
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

  async function send(e) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true); setErr('');

    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Sign in again.'); setBusy(false); return; }

    const id = crypto.randomUUID();

    /* Show it immediately. ⚠️ Optimistic ON PURPOSE here, and deliberately
       NOT for blocking (Aug 6) — the difference is what a wrong guess
       costs. A message that appears and then fails is a visible retry; a
       block that only LOOKS like it worked is dangerous. */
    const mine = {
      id, body: text, created_at: new Date().toISOString(),
      is_mine: true, handle: meHandle, display_name: 'you', display_avatar: null,
      pending: true,
    };
    noteStick();
    stickRef.current = true;              // you always follow your own message
    setMsgs((m) => [...m, mine]);
    setBody('');
    setEmoji(false);   // sending is finishing; leaving it open hides the room

    const { error } = await supabase
      .from('room_messages')
      .insert({ id, room_id: room.id, author_id: user.id, body: text });

    if (error) {
      setMsgs((m) => m.filter((x) => x.id !== id));
      setBody(text);                      // give them their words back
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
        ) : msgs.map((m) => (
          <div key={m.id} className={'rmsg' + (m.is_mine ? ' mine' : '') + (m.pending ? ' pending' : '')}>
            {!m.is_mine && <div className="rwho">{m.display_name}</div>}
            <div className="rbub">{m.body}</div>
          </div>
        ))}
      </div>

      {err && <div className="err">{err}</div>}

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
        <button className="rgo" type="submit" disabled={busy || !body.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
