'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { fetchCircle, whoLine, aliveLine, weekLine } from '../../lib/circles';

/* =====================================================================
   ⭕ YOUR CIRCLE.

   Ty, 11 Sept: "circles for people who start out at the same time in
   sobriety. So they have a small circle of people who start out with
   them and who grow with them in recovery."

   ⭐ THE BET: 180 of 253 members have never said a word anywhere. A room
   of 253 is a performance. A room of nine who all arrived the same week
   is a table. Nobody here is further along than you — that is the whole
   reason it might be easier to speak.

   🔴 FORMED ON JOIN WEEK, NOT SOBER DATE, and that was a measurement:
   104 members have no sober date at all and the biggest sober-date month
   is seven people. Date-based circles would have excluded 41% of the room.

   🔴 NOBODY IS EVER REMOVED. There is no leave button on this screen
   because there is no leave FUNCTION in the database — not for relapsing,
   not for going quiet. Your circle is who you walked in with.

   🔴 HANDLES, NEVER ANONYMOUS ALIASES. 218 of 253 members are anonymous,
   and in a room the handle already IS the pseudonym (0090). A second
   anonymous layer inside a group of nine makes it unreadable — you
   cannot answer somebody with no stable name.
   ===================================================================== */

export default function Circle() {
  const supa = browserClient();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const boxRef = useRef(null);

  async function load() {
    try { setData(await fetchCircle(supa)); } catch { setData({ circle: null, messages: [] }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr('');
    const { error } = await supa.rpc('say_in_circle', { t: body, photo: null });
    setBusy(false);
    /* ⚠️ NOT optimistic, unlike the big rooms. A circle of nine is small
       enough that a message which appears and then silently failed would
       have somebody believing eight people saw something nobody did. */
    if (error) { setErr("That didn't send. Try once more?"); return; }
    setText('');
    await load();
    boxRef.current?.focus();
  }

  if (!data) return null;

  const c = data.circle;

  /* ⚠️ Everybody has a circle — placement ran for all 253 members — so
     this branch should never show. It exists because a member created
     after tonight has no row until the signup hook is wired, and an
     empty screen with no explanation is worse than an honest one. */
  if (!c) {
    return (
      <section className="cir">
        <h1 className="cir-h">⭕ Your circle</h1>
        <p className="cir-sub">We haven&rsquo;t put you in one yet. Give it a day.</p>
      </section>
    );
  }

  return (
    <section className="cir">
      <h1 className="cir-h">⭕ Your circle</h1>
      <p className="cir-sub">{whoLine(c)} &middot; you all arrived around {weekLine(c)}</p>

      <div className="cir-strip">
        <span className="cir-alive">{aliveLine(c)}</span>
      </div>

      <ul className="cir-wall">
        {data.messages.length === 0 ? (
          /* 🔴 The empty state does NOT say "no messages yet" — that is a
             description of a dead room. It says what the room is for, and
             gives the first person something answerable to say. */
          <li className="cir-empty">
            Nobody&rsquo;s started yet. You could say what kind of week it&rsquo;s been &mdash;
            the others got here the same time you did.
          </li>
        ) : data.messages.map((m) => (
          <li key={m.id} className={m.is_mine ? 'cir-msg cir-mine' : 'cir-msg'}>
            <span className="cir-who">{m.is_mine ? 'you' : m.handle}</span>
            <span className="cir-body">{m.body}</span>
          </li>
        ))}
      </ul>

      <form className="cir-form" onSubmit={send}>
        <input ref={boxRef} className="cir-box" value={text} maxLength={2000}
               onChange={(e) => setText(e.target.value)}
               placeholder="Say something to your circle"
               aria-label="Say something to your circle" />
        <button type="submit" className="cir-send" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
      {err ? <p className="cir-err">{err}</p> : null}

      {/* ⚠️ Stated plainly on the screen, not just enforced in the schema.
          The promise only works if people know about it. */}
      <p className="cir-fine">
        Everyone here started the same week you did. Nobody gets removed from a circle &mdash;
        not for going quiet, not for starting over.
      </p>
    </section>
  );
}
