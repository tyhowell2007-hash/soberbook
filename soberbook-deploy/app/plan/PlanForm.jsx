'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   YOUR PLAN — the form.  7 Sept.  Migration 0146.

   ⚠️ SEVEN BOXES, ALL OPTIONAL, ONE SAVE. Not a wizard and not a
   required flow. Somebody who only knows the answer to one of these
   should be able to write that one and leave — a plan with one true
   line in it beats a blank one, and beats seven lines invented to get
   past a form.

   ⚠️ THE PROMPTS ARE PLAIN QUESTIONS, NOT CLINICAL HEADINGS. "What sets
   me off" rather than "Triggers"; "What it looks like starting" rather
   than "Early warning signs". Somebody filling this in is not doing
   paperwork, and the language a treatment centre uses is the language
   that makes this feel like paperwork.
   ===================================================================== */

const FIELDS = [
  ['sets_me_off',   'What sets me off',
   'People, places, times of day, feelings. Whatever is true.'],
  ['early_signs',   'What it looks like starting',
   'The things you notice a day or two before. Snapping at people, not eating, going quiet.'],
  ['what_works',    'What actually works',
   'The stuff that has genuinely worked before — not what should work.'],
  ['who_to_call',   'Who I can call',
   'Names and numbers. Nobody here is told they are on this list.'],
  ['why_im_here',   'Why I’m doing this',
   'The real reason, in your words.'],
  ['halt',          'Hungry, angry, lonely, tired',
   'Which one gets you, and what to do about that one.'],
  ['if_it_happens', 'If it happens anyway',
   'What you want the next morning to look like. Written now, while it is easy to be kind about it.'],
];

/* 🔴 SIX, AND THE CAP IS ENFORCED IN THE DATABASE TOO (0147). This
   number is the UI's copy of a rule that lives in craving_steps_ok() —
   if it ever changes, it changes in both places or the form silently
   offers a seventh box that will not save. The database is the one that
   decides; this is only how many boxes get drawn. */
const SLOTS = 6;

export default function PlanForm({ initial }) {
  /* Six fixed boxes, pre-filled from whatever is stored. Fixed rather
     than add-a-row: an empty box is an invitation, and an "add another"
     button is a thing to find. */
  const [steps, setSteps] = useState(() => {
    const a = (initial && initial.craving_steps) || [];
    return Array.from({ length: SLOTS }, (_, i) => a[i] || '');
  });
  const [sbusy, setSbusy] = useState(false);
  const [sok, setSok] = useState(false);
  const [serr, setSerr] = useState('');

  const [v, setV] = useState(() => {
    const start = {};
    for (const [k] of FIELDS) start[k] = (initial && initial[k]) || '';
    return start;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  /* ⚠️ THE UPDATER FORM, NOT set({...v, ...}). Reading `v` from the
     closure means two keystrokes landing in the same frame both start
     from the render's value and the second overwrites the first. That
     exact bug ate survey answers on 2 Sept and failed SILENTLY, in the
     direction of recording less than the person said. */
  function set(k, val) {
    setV((prev) => ({ ...prev, [k]: val }));
    setSaved(false);
  }

  /* ⚠️ THE UPDATER FORM AGAIN — see the note on set() below. Six boxes
     is exactly the shape that produced the survey bug on 2 Sept. */
  function setStep(i, val) {
    setSteps((prev) => {
      const next = prev.slice();
      next[i] = val;
      return next;
    });
    setSok(false);
  }

  async function saveSteps() {
    setSbusy(true);
    setSerr('');
    try {
      /* Blanks are dropped here AND in the function. Somebody who fills
         boxes 1, 2 and 5 means three steps, not two gaps. */
      const clean = steps.map((x) => x.trim()).filter(Boolean);
      const { error } = await browserClient()
        .rpc('save_my_craving_steps', { p_steps: clean });
      if (error) {
        setSerr(/too long/i.test(error.message || '')
          ? 'One of those is too long to fit on the screen.'
          : 'That didn’t save. Try once more?');
      } else {
        setSok(true);
        /* Re-seed from what was actually kept, so the boxes show the
           deduplicated, capped list the database really holds rather
           than what was typed. A form that lies about what it saved is
           worse than one that refuses. */
        setSteps(Array.from({ length: SLOTS }, (_, i) => clean[i] || ''));
      }
    } catch {
      setSerr('That didn’t save. Try once more?');
    }
    setSbusy(false);
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const { error } = await browserClient().rpc('save_my_plan', {
        p_sets_me_off:   v.sets_me_off   || null,
        p_early_signs:   v.early_signs   || null,
        p_what_works:    v.what_works    || null,
        p_who_to_call:   v.who_to_call   || null,
        p_why_im_here:   v.why_im_here   || null,
        p_halt:          v.halt          || null,
        p_if_it_happens: v.if_it_happens || null,
      });
      if (error) setErr('That didn’t save. Try once more?');
      else setSaved(true);
    } catch {
      setErr('That didn’t save. Try once more?');
    }
    setBusy(false);
  }

  return (
    <>
      <div className="mast">
        <Link href="/now" className="back" aria-label="Back">‹</Link>
        <span className="lg">Your plan</span>
      </div>

      <div className="pad">
        {/* 🔴 SAID FIRST, BEFORE THE FIRST BOX. Somebody deciding how
            honest to be about their triggers needs to know who reads it
            at the moment they decide — not after they have already
            typed it. Same reason the pledge says "Only you ever see
            this" above the input.

            ⚠️ "Not Ty" is named deliberately. In an app with a visible
            owner, "private" reads as "private from other members". It
            has to say that the person who built it can't read it
            either, because that is the actual question. */}
        <div className="pn-note">
          <p><b>Nobody sees this.</b> Not other members, not Ty. It isn’t in
             the moderation queue and there is no admin screen for it.</p>
          <p className="pn-note2">It’s here so that on a bad night the app can
             show you your own words instead of somebody else’s advice.</p>
        </div>

        {/* ---------------- THE CRAVING PLAN, FIRST ----------------
            ⭐ Above the seven boxes because it is the one most likely to
            get finished, and the one /now puts in front of somebody at
            3am. See plan.css for why it has its own Save. */}
        <div className="pn-steps">
          <label className="pn-lbl" htmlFor="pn-s0">When a craving hits, do this</label>
          <p className="pn-hint">
            A few short things that work for you, in the order you&apos;d do them.
            These go at the top of Right now — so on a bad night you start at
            number one instead of deciding anything.
          </p>
          {steps.map((val, i) => (
            <div className="pn-srow" key={i}>
              <span className="pn-sn" aria-hidden="true">{i + 1}</span>
              <input
                id={`pn-s${i}`}
                className="pn-sin"
                type="text"
                /* 🔴 80 matches the database's limit exactly. The box
                   cannot hold something the database will refuse — the
                   30 Aug handle lesson: the fix is not a better error
                   message, it is a field that can't be wrong. */
                maxLength={80}
                value={val}
                aria-label={`Step ${i + 1}`}
                placeholder={i === 0 ? 'Call someone' : i === 1 ? 'Get out of the house' : ''}
                onChange={(e) => setStep(i, e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="pn-ssave" disabled={sbusy} onClick={saveSteps}>
            {sbusy ? 'Saving…' : 'Save my list'}
          </button>
          {sok && !serr && <p className="pn-ok">Saved. It’s at the top of Right now.</p>}
          {serr && <p className="pn-err">{serr}</p>}
        </div>

        <hr className="pn-shr" />

        {FIELDS.map(([k, label, hint]) => (
          <div className="pn-f" key={k}>
            <label className="pn-lbl" htmlFor={`pn-${k}`}>{label}</label>
            <p className="pn-hint">{hint}</p>
            <textarea
              id={`pn-${k}`}
              className="pn-in"
              rows={3}
              maxLength={1000}
              value={v[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}

        <button type="button" className="pn-save" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save my plan'}
        </button>
        {/* ⚠️ The confirmation is a sentence, not a tick that fades.
            This is a form somebody fills in once and needs to believe
            landed. */}
        {saved && !err && <p className="pn-ok">Saved. It’s waiting for you on Right now.</p>}
        {err && <p className="pn-err">{err}</p>}

        <p className="pn-fine">
          You can clear every box and save to tear this up completely.
        </p>
      </div>
    </>
  );
}
