'use client';

import { useEffect, useRef, useState } from 'react';

/* =====================================================================
   THE PRACTICES.

   🔴 NOTHING HERE IS WRITTEN DOWN. NOT ONE BYTE.

   No table, no API call, no localStorage, no "you've done this 7 days".
   Everything below runs in the browser and vanishes when you close it.

   NOT STORING IT IS THE FEATURE. A record of who sat down at 3am
   because they were craving is a record that can be leaked, subpoenaed,
   handed to an insurer, or turned into a streak. It can be none of
   those things if it does not exist. This is the same argument that
   keeps the meditation history out of 0055 — there is deliberately no
   column anywhere that could hold it.

   ⚠️ AND NO STREAKS, which is the specific thing every wellness app
   does here. A streak punishes the night somebody couldn't, and that is
   the night it mattered. Same rule as meetings, same rule as the wall.

   ---------------------------------------------------------------------
   ⚠️ WHY EVERYTHING IS UNDER TEN MINUTES, AND IT IS A SAFETY CALL.

   Meditation has adverse effects, and the wellness industry does not
   mention them. Lindahl, Britton et al. (2017) documented
   depersonalisation, re-experiencing of trauma and destabilisation in
   meditators — concentrated among people with a trauma history, which
   is most of the people in this app.

   So: short, eyes open if you want, no long silent sits, no retreat
   framing. Under ten minutes isn't just convenient, it's safer.

   🔴 AND NOTHING HERE IS INTENSE BREATHWORK. The physiological sigh is
   two normal inhales and a long exhale. Holotropic-style
   hyperventilation can cause tetany, dissociation and panic, and none
   of it belongs in a recovery app.

   ⚠️ TONGLEN — breathing in other people's suffering — is deliberately
   absent too. It's beautiful and it destabilises trauma survivors. Not
   a starter practice, and this page is all starters.
   ===================================================================== */

export const PRACTICES = [
  {
    id: 'sigh',
    mark: '🌬️',
    when: 'I can’t breathe, my chest is tight',
    length: '60 seconds',
    title: 'Two breaths in, one long breath out',
    /* ⭐ Best-evidenced thing on this list by a distance. A 2023
       Stanford randomised trial (Balban et al., Cell Reports Medicine)
       found five minutes a day of cyclic sighing improved mood and
       lowered respiratory rate MORE than mindfulness meditation over a
       month — and it works acutely too. The long exhale drives the
       parasympathetic system, which is why you do it involuntarily
       after crying.

       It's first on the list because it works the first time you try
       it, needs no belief, and needs nothing but your own lungs. That
       buys trust for everything under it. */
    breath: true,
    steps: [
      'Breathe in through your nose.',
      'Then a second, shorter breath in on top of it.',
      'Now let it all go, slowly, out of your mouth.',
      'Again. Nothing else to do.',
    ],
    note: 'Your body already does this. It’s what happens after you cry.',
  },
  {
    id: 'urge',
    mark: '🌊',
    when: 'The craving won’t stop',
    length: '3 minutes',
    title: 'Ride it out instead of fighting it',
    /* From Mindfulness-Based Relapse Prevention (Bowen, Marlatt et al.)
       — real randomised trials in substance use. Results are moderate,
       not miraculous. The most directly relevant technique on this list
       to what members are actually doing, and teachable in three
       minutes with no Buddhism attached. */
    steps: [
      'Don’t fight it and don’t distract yourself. Just find it.',
      'Where is it in your body? Chest, stomach, jaw, hands?',
      'What does it actually feel like — hot, tight, buzzing, hollow?',
      'Watch it rise. Keep watching.',
      'It will crest, and then it will drop. They almost always do, inside twenty or thirty minutes.',
      'You are not doing anything. You are just outlasting it.',
    ],
    note: 'You don’t have to win. You have to still be here afterwards.',
  },
  {
    id: 'kind',
    mark: '🫂',
    when: 'I hate myself',
    length: '5 minutes',
    title: 'Say it to yourself first',
    /* ⭐ The only practice on this list that goes straight at shame,
       and shame is the engine of relapse. Most people arrive already
       fluent in self-hatred.

       ⚠️ It is also the one people find hardest, and the copy says so —
       directing kindness at yourself can feel false or bring up grief.
       Without that line people conclude they're doing it wrong. */
    steps: [
      'May I be safe.',
      'May I be well.',
      'May I be at ease.',
      'Say it again, slowly. You don’t have to mean it yet.',
      'Now somebody you love. Same words.',
      'Now somebody you’re struggling with, if you can. Skip it if you can’t.',
    ],
    note: 'If turning this on yourself feels fake, or makes you want to cry, that’s the normal response. It isn’t you doing it wrong.',
  },
  {
    id: 'body',
    mark: '🛏️',
    when: 'I can’t sleep',
    length: '10 minutes',
    title: 'Go through yourself, slowly',
    /* Core MBSR component; decent support for insomnia and the physical
       side of anxiety. Early recovery is enormously physical —
       restlessness, skin crawling, not sleeping. This one is for the
       body, not the mind. */
    steps: [
      'Start at your feet. Don’t change anything, just notice them.',
      'Ankles. Shins. Knees.',
      'Hips, stomach, lower back.',
      'Chest. Shoulders — most people are holding them up.',
      'Arms, hands, fingers.',
      'Neck. Jaw. Let it hang open a little.',
      'Behind the eyes. Forehead.',
      'If you drift off before the end, that was the point.',
    ],
    note: 'Nothing needs fixing. You’re only visiting.',
  },
  {
    id: 'review',
    mark: '🌇',
    when: 'Looking back on the day',
    length: '5 minutes',
    title: 'Five questions, and nobody owns them',
    /* ⭐ THE ONE TO LEAD THE SPIRITUAL SIDE WITH, because it is
       genuinely plural by construction: Ignatius' Examen (1500s) and
       the Stoic evening review (Seneca, Marcus Aurelius) are the SAME
       PRACTICE. A Jesuit and a Roman emperor arrived at the same five
       questions from opposite ends of the universe.

       That is a proof, not a slogan — nobody has to adopt anyone's God
       to do this. It's also the same shape as a Tenth Step.

       ⚠️ And both sources are PUBLIC DOMAIN. Free to quote, adapt and
       print, forever. AA, NA and Hazelden text is all copyrighted;
       Recovery Dharma is CC BY-NC and breaks the day Sober Book earns a
       dollar. This is the only well on the spiritual side we can drink
       from without asking anyone. */
    steps: [
      'Where was there any good in today? Even one minute of it.',
      'Where was it heavy?',
      'What did you do that you’d do again?',
      'What did you do that you wouldn’t?',
      'What do you want tomorrow to be?',
    ],
    note: 'A Jesuit priest and a Roman emperor wrote down almost exactly these questions, fifteen hundred years apart. You don’t have to belong to either of them.',
  },
];

/* ---------------------------------------------------------------------
   THE BREATHING CIRCLE

   ⚠️ A pure CSS animation, not a JS timer driving styles frame by
   frame. A phone throttles background timers and JS animation drifts,
   which on a breathing guide means you end up telling somebody to
   breathe in for nine seconds. The browser's own animation clock
   doesn't drift.

   ⚠️ The text label IS driven by a timer, and that's fine — if it slips
   by a beat it's a word out of step, not a bad instruction. The circle
   is the thing being followed.
   --------------------------------------------------------------------- */
function Breather() {
  const [phase, setPhase] = useState(0);
  const LABELS = ['in…', 'and a bit more…', 'out, slowly…', 'out…'];
  const HOLD   = [2600, 1200, 4200, 2000];

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % 4), HOLD[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="pr-breath" aria-hidden="true">
      <div className="pr-circle" />
      <p className="pr-cue">{LABELS[phase]}</p>
    </div>
  );
}

export default function Practice({ p, onDone }) {
  /* ⚠️ No elapsed timer, no countdown, no "2:31 remaining". A clock on
     this screen turns sitting still into a task you are failing at, and
     the person here is already having a bad enough night. You leave
     when you want to leave. */
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="pad pr-wrap">
      <button type="button" className="pr-back" onClick={onDone} ref={ref}>
        ← back
      </button>

      <p className="pr-mark" aria-hidden="true">{p.mark}</p>
      <h2 className="pr-title">{p.title}</h2>
      <p className="pr-when">{p.when} · {p.length}</p>

      {p.breath && <Breather />}

      <ol className="pr-steps">
        {p.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      <p className="pr-note">{p.note}</p>

      <p className="pr-stop">
        If this makes you feel worse, stop. That happens to some people
        and it isn’t a failure — open your eyes, put your feet on the
        floor, and go find a person instead.
      </p>

      <button type="button" className="btn pr-done" onClick={onDone}>
        Done
      </button>

      {/* 🔴 No "well done", no completion tick, nothing recorded. You
          tapped Done; the app has no memory that you were ever here. */}
    </div>
  );
}
