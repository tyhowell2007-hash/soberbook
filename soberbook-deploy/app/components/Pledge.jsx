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

/* 🔴 HOW'S THE CRAVING RIGHT NOW — 7 Sept, migration 0144.

   ⚠️ The migration is named 0144_how_strong_is_the_pull because that
   was the wording when it was applied, and a migration is history —
   append-only, like a campaign key. The LABEL is Ty's, changed the same
   day: "the pull" is our metaphor, and the app already says "craving"
   on the urge-surfing practice in /quiet. One word across both surfaces
   means nobody has to learn our language to answer a question about
   themselves. The column has always been `craving`.

   Ty asked for MyRecoveryPal's check-in, which scores your MOOD 1–6
   every day. Reading the schema first showed we already had that half:
   review_today() has logged hard / alright / good since 1 Sept and 17
   people use it. A second mood scale would have been the same question
   asked twice, and the second copy drifts.

   ⭐ CRAVING IS THE OTHER AXIS, AND IT IS THE ONE THAT WAS MISSING.
   `felt` is retrospective and about mood; this is right now and about
   RISK. A bad day and a dangerous day are not the same day — people
   relapse on good ones.

   ⚠️ IT KEEPS THE PROPERTY THAT MAKES THE PLEDGE WORK. A pledge is an
   intention, so it cannot be falsified. "Rough" cannot be either: it is
   a fact about an hour, not a grade. That is exactly why a mood SCORE
   was refused here and this was not — a score can be wrong, performed,
   and turned into a report card.

   🔴 NOTHING RANKS IT, SUMS IT, OR SHOWS IT TO ANOTHER MEMBER, and
   there is deliberately no craving version of pledges_today_count().
   "12 people are struggling today" is a leaderboard of pain.

   ⚠️ OPTIONAL, AND null IS NOT 'none'. Saying there's no craving and
   not answering are different facts, and the button works either way — the
   pledge being effortless is the whole reason 55 of 234 members use it.
   Making it a required second step would buy a data column with the one
   feature that is working. */
/* ⚠️ THE FACES ARE TY'S CALL, MADE AFTER HEARING THE ARGUMENT AGAINST.
   7 Sept: "I wanna do faces and emojis." My advice was words only — a face
   turns a craving level into a MOOD grade, and 😣 on "Strong" tells somebody
   they are miserable when the honest answer is often "I'm fine, it's just
   loud today." He chose faces. Recorded here so nobody re-opens it thinking
   it was never noticed.

   🔴 THE WORD STAYS UNDER EVERY FACE AND MUST NEVER BE REMOVED. An emoji
   alone is not a label: it reads differently to different people, it is
   unusable to a screen reader, and 😐 vs 😣 is not a distinction anybody
   can make reliably at 6am. The face is decoration on a word, not a
   replacement for it. */
const CRAVING = [
  ['none',   'None',   '😌'],
  ['mild',   'Mild',   '🙂'],
  ['some',   'Some',   '😐'],
  ['strong', 'Strong', '😣'],
  ['rough',  'Rough',  '😖'],
];

export default function Pledge() {
  const [s, setS] = useState(null);      // null = still asking the server
  const [count, setCount] = useState(null);
  const [why, setWhy] = useState('');
  const [craving, setCraving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openReview, setOpenReview] = useState(false);
  const [note, setNote] = useState('');

  /* 🔴 TELL THE SERVER WHERE THIS PERSON ACTUALLY IS — 3 Sept.

     profiles.timezone is NOT NULL DEFAULT 'America/New_York' and nothing
     had ever written to it. Measured: all 197 members sat on Eastern,
     including everybody who isn't. member_today() reads that column to
     decide when your day ends, so a pledge at 10pm in California was
     filed as TOMORROW and 2am in the UK as YESTERDAY — and the streak
     then broke for a reason the member could not see and did not cause.

     ⭐ On the one feature built so it can never be falsified — a pledge is
     an intention, true even on the worst morning of your year — a wrong
     day boundary was the single thing that could still make it lie.

     ⚠️ IT LIVES HERE, NOT IN THE ROOT LAYOUT, BECAUSE THIS IS THE ONLY
     PLACE THE COLUMN MATTERS. Nothing else in the app reads it. Mounting
     a reporter on every page would touch 197 rows to fix a number only
     this card uses.

     ⚠️ AWAITED, AND BEFORE THE STATS — NOT IN THE Promise.all BELOW.
     my_pledge_stats is computed FROM the timezone. Fire them together and
     the first visit after landing in a new zone renders yesterday's day
     and yesterday's streak, which is the bug wearing a smaller hat.

     ⚠️ Wrapped, and failure is silent on purpose: no timezone is the
     status quo we are already living with, and a card that refuses to
     draw because a clock lookup failed is far worse than one showing a
     day boundary that is a few hours off. */
  async function reportTimezone(supabase) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      /* The server validates this against pg_timezone_names and keeps the
         old value if it doesn't recognise it — we never have to trust
         whatever the browser hands us. */
      if (tz) await supabase.rpc('set_my_timezone', { p_tz: tz });
    } catch { /* keep whatever is on the row */ }
  }

  async function load() {
    const supabase = browserClient();
    await reportTimezone(supabase);
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
      await browserClient().rpc('pledge_today',
        { p_why: why || null, p_craving: craving });
      await load();
      setWhy('');
      setCraving(null);
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
        <p className="pl-head">🌱 One more day.</p>
        <p className="pl-sub">✍️ Why today? One line is plenty.</p>
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
        {/* ⚠️ BELOW the why and ABOVE the button, deliberately. The
            intention is the thing being made; the craving is context on it.
            Put the chips first and the screen opens by asking somebody
            how bad it is, which is a different — and worse — first
            question at 6am. */}
        {/* ⚠️ "craving", not "the pull" — Ty's call, 7 Sept. The app
            already uses that word: the urge-surfing practice on Quiet
            is titled "The craving won't stop". One word across both
            surfaces means nobody has to learn our metaphor to answer a
            question about themselves. */}
        <p className="pl-craveq">🌊 How&apos;s the craving right now?</p>
        <div className="pl-craves" role="group"
             aria-label="How's the craving right now">
          {CRAVING.map(([k, label, face]) => (
            <button
              key={k}
              type="button"
              /* ⚠️ aria-pressed, not a radio. Nothing is selected by
                 default and it can be un-picked, so "which one is on" is
                 the honest description of the state. */
              aria-pressed={craving === k}
              className={'pl-crave' + (craving === k ? ' on' : '')}
              onClick={() => setCraving((prev) => (prev === k ? null : k))}
            >
              <span className="pl-craveface" aria-hidden="true">{face}</span>
              <span className="pl-craveword">{label}</span>
            </button>
          ))}
        </div>
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
      <p className="pl-day">🌱 Said it today</p>
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

      {/* ⚠️ Past tense, and it names the CRAVING rather than the person.
          "The craving was rough" is a fact about an hour that has already
          gone; "you were struggling" is a label somebody has to wear for
          the rest of the day on their own home screen.

          ⚠️ Rendered only when they answered. null and 'none' are
          different facts — 'none' means there was no craving and is worth
          seeing back; not answering is worth nothing at all. */}
      {s.today_craving && (
        <p className="pl-cravewas">
          {s.today_craving === 'none'
            ? '🌊 No craving when you said it.'
            : `🌊 The craving was ${s.today_craving} when you said it.`}
        </p>
      )}

      {/* The evening half. ⚠️ Never chased, never required — the MORNING
          is the streak. Two required halves is two ways to fail instead
          of one thing to do. */}
      {!s.reviewed && !openReview && (
        <button type="button" className="pl-rev" onClick={() => setOpenReview(true)}>
          🌙 How was today?
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
      {s.reviewed && <p className="pl-done-rev">🌙 Logged for tonight.</p>}

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
