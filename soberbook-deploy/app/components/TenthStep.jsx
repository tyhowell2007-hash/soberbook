'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   YOUR 10TH STEP — the nightly inventory.  15 Sept.  Migration 0155.

   🔴 THE TEN QUESTIONS BELOW ARE WRITTEN FROM SCRATCH AND THEY HAVE TO
   STAY THAT WAY. The Twelve Steps and the inventory questions in the Big
   Book are (c) AA World Services. NAMING the step is a factual reference
   and is fine — that is Ty's call and it is on the masthead. REPRODUCING
   their wording is not, and this project already refused Just For Today
   ((c) NA World Services) on the readings page for the same reason.
   ⚠️ Do NOT "improve" one of these by reaching for the phrasing you half
   remember. If a question needs changing, write a new sentence.

   ⚠️ THE KEY AND THE SENTENCE ARE DIFFERENT THINGS, ON PURPOSE. The
   database stores `q` — a short stable key, and its allowlist is a CHECK
   constraint so a browser cannot invent one and use the table as free
   private storage. This file owns the WORDING. So a question can be
   reworded tomorrow without orphaning what people already answered, and
   the survey's answer values work exactly this way for the same reason.
   🔴 Adding an eleventh question is a MIGRATION, not an edit here — and
   it should be. Ten questions people answer every night is a contract.

   ---------------------------------------------------------------------
   WHAT THIS REFUSES, AND EVERY ONE IS LOAD-BEARING.

   🔴 NO STREAK. Same argument as gratitude: some nights you don't do
   this, and a counter that resets punishes the night somebody most
   needed to skip it. There is no streak column in 0155. Absent, not
   hidden.

   🔴 NO SCORE. Nine yeses is not a worse day than one. Nothing is added
   up, nothing is graded, and there is no chart.

   🔴 NO COUNT, AND THIS IS WHERE IT PARTS FROM EVERYTHING ELSE. The
   pledge publishes "you and 11 others" and gratitude publishes a whole
   wall — both deliberate, both about not feeling alone. This publishes
   NOTHING. There is no `tenth_step_today_count()` in the schema, because
   a count of who took an inventory tonight is a count of who thinks they
   have something to answer for.

   🔴 NOT SCREENED. `screen_reason()` (0151) runs on everything published
   to somebody. 0151's own note says private messages are exempt because
   Guideline 1.2 covers material "posted to the app". Nothing here is
   posted to anyone, so screening it would mean reading the most private
   text a member writes to enforce a rule about publishing.

   ⚠️ EVERY QUESTION IS SKIPPABLE and a skipped one writes no row at all.
   Ten required boxes at 11pm is a wall, and the wall is what stops
   somebody doing the one question that mattered.
   ===================================================================== */

/* ⚠️ The key on the left must match the CHECK constraint in 0155 exactly.
   If they ever disagree the database refuses the save and the member sees
   a failure they cannot act on. */
const QUESTIONS = [
  ['rattled',   'Did anything get under my skin today?'],
  ['honest',    'Was I honest?'],
  ['afraid',    'Was I scared of something?'],
  ['selfish',   'Did I put myself first when I didn’t need to?'],
  ['harm',      'Did I hurt anybody?'],
  ['apology',   'Do I owe somebody an apology?'],
  ['holding',   'Am I holding something in that I should say out loud?'],
  ['showed_up', 'Did I show up for somebody else?'],
  ['went_right','Did something go right?'],
  ['tomorrow',  'Is there one thing I want to do differently tomorrow?'],
];

const ASK = Object.fromEntries(QUESTIONS);

/* Matches inventory_note_sane in 0155. ⚠️ Restated here ONLY as a
   maxLength, which is a convenience and not the rule — the database
   refuses 281 regardless, and was proven refusing it. This copy can only
   ever be politer than the first, never more permissive. */
const CAP = 280;

export default function TenthStep() {
  /* undefined = still asking the server. [] = nothing put down tonight.
     a list = what they said. ⚠️ Three states, not two — flashing ten
     blank questions at somebody who already did this is the app
     forgetting them, at the hour it matters most. */
  const [was, setWas] = useState(undefined);
  const [answers, setAnswers] = useState({});   // key -> true | false
  const [notes, setNotes] = useState({});       // key -> string
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(null);

  async function load() {
    const { data } = await browserClient().rpc('my_tenth_step');
    setWas(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load().catch(() => setWas([])); }, []);

  function pick(key, value) {
    setRefused(null);
    /* ⚠️ THE UPDATER FORM, NEVER A READ OF STATE. On 2 Sept the survey's
       toggle did `set(list.includes(k) ? … )`, which closes over the
       array as it was at RENDER — so two taps inside one frame both
       started from the same object and the second overwrote the first.
       Measured: thirteen fast taps left ONE chip lit. It fails silently
       and in the direction of recording LESS than the member said, which
       on a ten-question form is the worst way to be wrong. */
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[key] === value) delete next[key];   // tapping the same one un-picks it
      else next[key] = value;
      return next;
    });
  }

  function note(key, text) {
    setRefused(null);
    setNotes((prev) => ({ ...prev, [key]: text }));
  }

  async function save() {
    const payload = Object.entries(answers).map(([q, answer]) => {
      const n = (notes[q] || '').trim();
      return n ? { q, answer, note: n } : { q, answer };
    });
    if (!payload.length || busy) return;
    setBusy(true);
    setRefused(null);
    try {
      await browserClient().rpc('tenth_step_save', { p_answers: payload });
      await load();
      setEditing(false);
    } catch (e) {
      setRefused((e && e.message) || 'That did not save. Try once more?');
    }
    setBusy(false);
  }

  async function takeItDown() {
    setBusy(true);
    try {
      await browserClient().rpc('undo_my_tenth_step');
      await load();
      setAnswers({});
      setNotes({});
      setEditing(false);
    } catch { /* leave it; a reload tells the truth */ }
    setBusy(false);
  }

  function reopen() {
    /* Seed the form from what is already down, so "change it" edits
       rather than starting from blank. */
    const a = {}, n = {};
    for (const r of was || []) { a[r.q] = r.answer; if (r.note) n[r.q] = r.note; }
    setAnswers(a);
    setNotes(n);
    setEditing(true);
  }

  if (was === undefined) return null;

  /* ---------------- nothing down tonight, or changing it ------------- */
  if (!was.length || editing) {
    const picked = Object.keys(answers).length;
    return (
      <div className="tenth-card">
        <p className="tenth-eyebrow">Tonight</p>
        <p className="tenth-head">Ten questions.</p>
        <p className="tenth-sub">
          Answer what you want. Skip what you don&rsquo;t. Nobody sees any of it.
        </p>

        {QUESTIONS.map(([key, ask]) => (
          <div key={key}>
            <div className="tenth-q">
              <span className="tenth-ask" id={`tenth-${key}`}>{ask}</span>
              {/* ⚠️ aria-pressed, not a radio group. Nothing is selected by
                  default and either answer can be un-picked, so "which one
                  is on" is the honest description of the state. */}
              <button type="button" className={'tenth-pill' + (answers[key] === true ? ' on' : '')}
                      aria-pressed={answers[key] === true}
                      aria-describedby={`tenth-${key}`}
                      onClick={() => pick(key, true)}>Yes</button>
              <button type="button" className={'tenth-pill' + (answers[key] === false ? ' on' : '')}
                      aria-pressed={answers[key] === false}
                      aria-describedby={`tenth-${key}`}
                      onClick={() => pick(key, false)}>No</button>
            </div>
            {/* ⚠️ The line only appears once the question has an answer.
                Ten open boxes at once reads as ten essays due, which is
                the thing that stops somebody starting at all. */}
            {answers[key] !== undefined && (
              <input
                className="tenth-note"
                value={notes[key] || ''}
                maxLength={CAP}
                onChange={(e) => note(key, e.target.value)}
                placeholder="A line, if you want one"
                aria-label={ask + ' — anything you want to add'}
              />
            )}
          </div>
        ))}

        {refused && <p className="tenth-sub" style={{ margin: '0.7rem 0 0' }}>{refused}</p>}

        <div className="tenth-row">
          <button type="button" className="tenth-go" disabled={busy || !picked} onClick={save}>
            {busy ? 'One second…' : 'Put it down'}
          </button>
          {editing && was.length > 0 && (
            <button type="button" className="tenth-quiet" disabled={busy}
                    onClick={() => { setEditing(false); setRefused(null); }}>
              Never mind
            </button>
          )}
        </div>

        {/* ⚠️ Said BEFORE they answer, not after. Somebody deciding how
            honest to be needs to know who reads it at the moment they
            decide — and here the honest answer is the strongest one in
            the app, so it is spelled out rather than summarised. */}
        <p className="tenth-priv">
          Only you ever see this. Not other members, not Ty, not the moderation
          queue. Nothing here is counted, scored, or kept as a streak.
        </p>
      </div>
    );
  }

  /* ---------------- put down: the record for the night -------------- */
  return (
    <div className="tenth-card">
      <p className="tenth-eyebrow">Tonight you put down</p>
      <ul className="tenth-was">
        {was.map((r) => (
          <li key={r.q} className="tenth-line">
            <span className="tenth-yn">{r.answer ? 'Yes' : 'No'}</span>
            {ASK[r.q] || r.q}
            {r.note && <span className="tenth-said">&ldquo;{r.note}&rdquo;</span>}
          </li>
        ))}
      </ul>
      <div className="tenth-row">
        <button type="button" className="tenth-quiet" disabled={busy} onClick={reopen}>
          Change it
        </button>
        {/* 🔴 A WAY TO TAKE IT BACK, and it is not optional. Somebody who
            wrote something at 11pm and regrets it at 11:04 needs a
            control, not an email to Ty. undo_my_tenth_step() deletes only
            the caller's own rows for their own today — the identity test
            is in the WHERE clause, never a separate guard above it. */}
        <button type="button" className="tenth-quiet" disabled={busy} onClick={takeItDown}>
          Take it down
        </button>
      </div>
      <p className="tenth-priv">
        This stays with you. Tomorrow night starts blank &mdash; there is no
        streak to keep and nothing is added up.
      </p>
    </div>
  );
}
