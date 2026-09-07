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

export default function PlanForm({ initial }) {
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
