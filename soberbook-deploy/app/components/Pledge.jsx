'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   ONE MORE DAY — the daily pledge.  1 Sept.

   Ty asked for this after using I Am Sober every day. Their loop is a
   bookend: write WHY you'll stay sober this morning, review how the day
   went tonight, keep a streak.

   ⭐ WE TOOK THE LOOP AND REFUSED THE MECHANIC. Their own marketing says
   the streak works by "making the idea of breaking the streak less
   appealing" — loss aversion. It works, and it means the number is taken
   away on the worst morning of somebody's year, which is the morning they
   most need to open the app.

   🔴 SO THE STREAK COUNTS PLEDGES, NOT SOBER DAYS. A pledge is an
   INTENTION, so it can never be falsified — you can say "one more day" at
   6am after a relapse and it is completely true. Day 1 after starting
   over is the loudest number on this card, not the most shameful.

   ⚠️ "ONE MORE DAY", NOT "JUST FOR TODAY". Ty's call. The second is NA's
   signature phrase and would quietly make this a fellowship app — the
   banner says "All paths welcome — Suboxone included". One more day
   belongs to nobody.

   ---------------------------------------------------------------------
   🔴 THE REASON IS PRIVATE AND NOTHING WILL EVER MAKE IT OTHERWISE.
   No policy, no view and no function in the schema returns another
   member's `why` — not to friends, not to the owner, not to /admin.
   People write things like "because my daughter is coming over on
   Saturday". That is the most private text in this app precisely because
   it was never written to be read.

   ⚠️ AND IT WILL NEVER SEND A NOTIFICATION. 130 members were emailed
   "no reminders, no streaks, no nudges to come back" on 31 Aug. A daily
   pledge reminder breaks that sentence. The card has to earn the open —
   which is a real cost, because a reminder is exactly what would make
   people come back, and we gave that up on purpose.
   ===================================================================== */

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function Pledge() {
  const [s, setS] = useState(null);      // null = still asking the server
  const [count, setCount] = useState(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [openReview, setOpenReview] = useState(false);
  const [note, setNote] = useState('');

  async function load() {
    const supabase = browserClient();
    const [{ data: stats }, { data: n }] = await Promise.all([
      supabase.rpc('my_pledge_stats'),
      supabase.rpc('pledges_today_count'),
    ]);
    /* my_pledge_stats returns one row; supabase hands back an array. */
    setS(Array.isArray(stats) ? stats[0] : stats);
    setCount(typeof n === 'number' ? n : null);
  }

  useEffect(() => { load().catch(() => setS(false)); }, []);

  async function say() {
    setBusy(true);
    try {
      await browserClient().rpc('pledge_today', { p_why: why || null });
      await load();
      setWhy('');
    } catch { /* leave the form up; a reload tells the truth */ }
    setBusy(false);
  }

  async function review(felt) {
    setBusy(true);
    try {
      await browserClient().rpc('review_today', { p_felt: felt, p_note: note || null });
      await load();
      setOpenReview(false);
      setNote('');
    } catch { /* same */ }
    setBusy(false);
  }

  /* ⚠️ Render NOTHING until the server has answered. Flashing the ask at
     somebody who already pledged this morning is the app forgetting them,
     and it is the first thing they'd see on opening it. */
  if (s === null || s === false) return null;

  /* ---------------- not said yet: the ask ---------------- */
  if (!s.said_today) {
    return (
      <div className="pl pl-ask">
        <p className="pl-day">{DAYS[new Date().getDay()]}</p>
        <p className="pl-head">One more day.</p>
        <p className="pl-sub">Why today? One line is plenty.</p>
        <input
          className="pl-in"
          value={why}
          maxLength={280}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Because…"
          /* ⚠️ Enter submits. This is a one-line thing and reaching for a
             button after typing one sentence is friction on the exact
             action we want to be effortless. */
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) say(); }}
        />
        <button type="button" className="pl-go" disabled={busy} onClick={say}>
          {busy ? 'One second…' : 'I’m in'}
        </button>
        {/* ⚠️ Said BEFORE they type, not after. Somebody deciding how
            honest to be needs to know who reads it at the moment they
            decide, not once it's saved. */}
        <p className="pl-priv">Only you ever see this.</p>
      </div>
    );
  }

  /* ---------------- said it: the record for the rest of the day ------- */
  return (
    <div className="pl pl-done">
      <p className="pl-day">Said it today ✓</p>
      <p className="pl-streak">
        {s.streak === 1 ? 'Day 1' : `${s.streak} in a row`}
      </p>
      {/* 🔴 DAY 1 GETS A SENTENCE, AND IT IS THE WHOLE ARGUMENT OF THIS
          FEATURE. Every other app treats 1 as the wreckage of a bigger
          number. Here it is the day somebody came back. */}
      {s.streak === 1 && s.lifetime > 1 && (
        <p className="pl-again">Again. That’s the hard one.</p>
      )}
      <p className="pl-life">
        {s.lifetime} {s.lifetime === 1 ? 'time' : 'times'} altogether
      </p>

      {s.today_why && <p className="pl-why">“{s.today_why}”</p>}

      {/* The evening half. ⚠️ Never chased, never required — the MORNING
          is the streak. Two required halves is two ways to fail instead
          of one thing to do. */}
      {!s.reviewed && !openReview && (
        <button type="button" className="pl-rev" onClick={() => setOpenReview(true)}>
          How was today?
        </button>
      )}
      {!s.reviewed && openReview && (
        <div className="pl-revbox">
          <input
            className="pl-in"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to remember…"
          />
          <div className="pl-felts">
            {['hard','alright','good'].map((f) => (
              <button key={f} type="button" className="pl-felt"
                      disabled={busy} onClick={() => review(f)}>
                {f === 'hard' ? 'Hard' : f === 'alright' ? 'Alright' : 'Good'}
              </button>
            ))}
          </div>
        </div>
      )}
      {s.reviewed && <p className="pl-done-rev">Logged for tonight.</p>}

      {/* ⭐ THE ONLY THING ANYBODY ELSE TOUCHES: A COUNT. No names, no
          handles, no ranking, and no member's number ever sits next to
          another's. It is the not-alone feeling that a solo tracker
          structurally cannot give you. */}
      {count !== null && count > 1 && (
        <p className="pl-count">You and {count - 1} others, today.</p>
      )}
    </div>
  );
}
