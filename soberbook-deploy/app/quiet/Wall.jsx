'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Practice, { PRACTICES } from './Practice';

/* =====================================================================
   THE WALL OF HIGHER POWERS, THE PRACTICES, AND THE ROOM.

   🔴 THERE IS NO REPLY BUTTON ANYWHERE IN THIS FILE, AND THERE IS NO
   LIKE BUTTON EITHER. That isn't an omission — the database has no
   table to put either one in (0055). If somebody ever asks for replies
   here, it's a schema change, and it should feel like one.

   ⚠️ NO COUNT OF ANSWERS. Not "6 people have shared". At six members
   that number is a verdict on the room; at six hundred it becomes a
   score. The page shows the answers and says nothing about how many.
   ===================================================================== */

/* The face next to a name. ⚠️ ONE COMPONENT, because on Aug 18 the face
   was computed three different ways in three files and one of them had
   'TY' hardcoded into every member's profile. */
function Face({ a }) {
  if (a.display_avatar) return <span className="hp-face" aria-hidden="true">{a.display_avatar}</span>;
  return (
    <span className="hp-face hp-face-blank" aria-hidden="true">
      {a.is_anonymous ? '·' : (a.display_name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

/* The signature under an answer.

   ⚠️ The day count is printed only when the view handed one over, and
   the view already applied the author's own privacy setting and returns
   null for anything anonymous. There is no second decision here — the
   0046→0049 lesson: a rule restated in a second place is a second
   implementation, and the second one drifts. */
function Sig({ a }) {
  const days = a.author_days;
  const name = a.display_name || 'someone';
  const label = days == null
    ? name
    : `${name} · ${days.toLocaleString()} ${days === 1 ? 'day' : 'days'}`;

  /* An anonymous answer is not a link. Linking it to a profile would
     undo the entire thing in one <a>. */
  if (a.is_anonymous || !a.handle) return <p className="hp-sig">{label}</p>;
  return (
    <p className="hp-sig">
      <Link href={`/u/${a.handle}`}>{label}</Link>
    </p>
  );
}

export default function Wall({ answers, mine }) {
  const [list, setList] = useState(answers);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(mine?.body || '');
  const [anon, setAnon] = useState(mine?.is_anonymous || false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [practice, setPractice] = useState(null);

  const has = !!mine;
  const left = 280 - body.length;

  async function save() {
    const t = body.trim();
    if (t.length < 2) { setErr('Write something first, even if it’s one word.'); return; }
    setBusy(true); setErr('');
    const supabase = browserClient();
    const { error } = await supabase.rpc('set_my_higher_power', { answer: t, anonymous: anon });
    if (error) { setErr(error.message); setBusy(false); return; }
    /* Reload rather than patching the list by hand. The row has to come
       back THROUGH THE VIEW — that's what decides whether it carries an
       alias or a name, and what the day count is. Building the new card
       from local state would be a second, wrong copy of that logic. */
    window.location.reload();
  }

  async function clear() {
    setBusy(true); setErr('');
    const supabase = browserClient();
    const { error } = await supabase.rpc('clear_my_higher_power');
    if (error) { setErr(error.message); setBusy(false); return; }
    window.location.reload();
  }

  if (practice) {
    return <Practice p={practice} onDone={() => setPractice(null)} />;
  }

  return (
    <div className="pad hp-wrap">

      {/* ---- 1. WHAT GETS YOU THROUGH ---- */}
      <h2 className="hp-h">What gets you through</h2>
      <p className="hp-lede">
        Whatever it is. Nobody here will argue with you about it —
        there is no reply button on this page, on purpose.
      </p>

      {!has && !open && (
        <button type="button" className="btn hp-add" onClick={() => setOpen(true)}>
          Say what gets you through
        </button>
      )}

      {(open || (has && open)) && (
        <div className="hp-compose">
          <textarea
            value={body}
            maxLength={280}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
            placeholder="My daughter. That’s it. That’s the whole thing."
            aria-label="What gets you through"
          />
          <div className="hp-crow">
            {/* ⚠️ The anonymous switch sits ON the composer, not in
                settings. Somebody deciding whether to sign this is
                deciding it right now, about these words — not in a
                preferences screen they'll never find. */}
            <button
              type="button"
              className={'hp-anon' + (anon ? ' on' : '')}
              aria-pressed={anon}
              onClick={() => setAnon(!anon)}
            >
              {anon ? '🌱 anonymous' : '🙂 signed'}
            </button>
            <span className={'hp-left' + (left < 30 ? ' low' : '')}>{left}</span>
          </div>
          <div className="hp-actions">
            <button type="button" className="btn" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : has ? 'Change mine' : 'Put it up'}
            </button>
            <button type="button" className="btn ghost" disabled={busy}
                    onClick={() => { setOpen(false); setBody(mine?.body || ''); setErr(''); }}>
              Cancel
            </button>
            {has && (
              <button type="button" className="btn ghost hp-del" disabled={busy} onClick={clear}>
                Take mine down
              </button>
            )}
          </div>
          {err && <p className="hp-err" role="alert">{err}</p>}
          <p className="hint hp-note">
            You can change it any time. Everyone gets one answer, so
            changing yours replaces it rather than adding another.
          </p>
        </div>
      )}

      {list.length === 0 && (
        /* ⚠️ An invitation, not an apology. "Nothing here yet" on a page
           about what keeps you alive reads as a verdict on the room. */
        <div className="hp-empty">
          <p>Nobody has said yet. You could be first.</p>
        </div>
      )}

      <ul className="hp-list">
        {list.map((a) => (
          <li key={a.id} className={'hp-card' + (a.is_mine ? ' mine' : '')}>
            <p className="hp-body">{a.body}</p>
            <div className="hp-foot">
              <Face a={a} />
              <Sig a={a} />
              {a.is_mine && (
                <button type="button" className="hp-edit"
                        onClick={() => { setBody(a.body); setAnon(a.is_anonymous); setOpen(true); }}>
                  yours · change it
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* ---- 2. PRACTICES ---- */}
      <h2 className="hp-h hp-h2">If it’s bad right now</h2>
      <p className="hp-lede">
        None of these need you to believe anything. Pick whichever one
        matches the next few minutes.
      </p>

      <ul className="hp-prac">
        {PRACTICES.map((p) => (
          <li key={p.id}>
            <button type="button" className="hp-pbtn" onClick={() => setPractice(p)}>
              {/* aria-hidden — "wind face" announced before "I can't
                  breathe, my chest is tight" helps nobody. */}
              <span className="hp-pmark" aria-hidden="true">{p.mark}</span>
              <span className="hp-pwhen">{p.when}</span>
              <span className="hp-plen">{p.length}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* 🔴 SAID PLAINLY, AND IT IS NOT A DISCLAIMER FOOTER — it sits
          with the practices where somebody will actually read it. In an
          app full of people who were told to pray their way out of an
          illness, a feature that implies otherwise is dangerous. */}
      <p className="hp-care">
        None of this treats depression or anxiety. It sits alongside a
        doctor, a therapist and medication — never instead of them.
      </p>

      {/* ---- 3. THE READINGS ----
          ⚠️ A LINK OUT, NOT A SECTION ON THIS PAGE, and that placement
          is the whole argument. This page runs on "nobody here has to
          agree". Put scripture ON it and it becomes the house religion
          — and then a Buddhist sit, or a Muslim member, or an hour with
          no God in it can only ever be added later as a concession.

          Behind a door, it's one thing on a shelf that other things can
          go on. On the page, it's the page. */}
      <h2 className="hp-h hp-h2">If you read scripture</h2>
      <p className="hp-lede">
        Six passages where the person in the story is in the state
        you’re in. Not the fridge-magnet verses.
      </p>
      <Link href="/readings" className="btn hp-room">
        <span aria-hidden="true">⛪ </span>The parts nobody preaches
      </Link>

      {/* ---- 4. THE ROOM ---- */}
      <h2 className="hp-h hp-h2">Sit with other people</h2>
      <p className="hp-lede">
        Anyone with 90 days can open a room and call it whatever they
        like — a Sunday reading, a morning meditation, a quiet hour.
      </p>
      <Link href="/meetings" className="btn hp-room">See what’s open</Link>
    </div>
  );
}
