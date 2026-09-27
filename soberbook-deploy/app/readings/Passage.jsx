'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATION } from './constants';

/* =====================================================================
   ONE READING ON THE SCREEN — used by today's and by any one opened
   out of the library, so the two can never drift apart.

   ⭐ THE FLYER TREATMENT. Ty picked it in August: black ink on
   newsprint, the verse set big and hard like a lyric sheet. It is the
   one room in the app that is not the green room.

   ⚠️ EVERY CLASS IS PREFIXED rd-. The Aug 16 photos bug: `.composer`
   was declared in two stylesheets and the collision unpinned the
   message box.

   🔴 NOTHING IS STORED. No tick, no "read", no progress. There is no
   table for this feature and no write anywhere in this file.
   ===================================================================== */

/* ---------------------------------------------------------------------
   READ IT TO ME.

   ⚠️ THIS IS THE PHONE'S OWN VOICE, ON PURPOSE. Nothing is uploaded,
   nothing is fetched, nothing costs a cent per play, and it works with
   no signal. Recorded narration was the alternative and it is a real
   decision with a real bill attached — it is Ty's to make, and until he
   makes it this stays free.

   ⚠️ speechSynthesis is missing or inert in more browsers than you
   would think, and in some it throws rather than returning false. Every
   entry point is guarded and the button says so rather than going dead.

   ⚠️ The utterance is cancelled on unmount. Without that, navigating
   away leaves the phone talking about Elijah on the meetings page.
   --------------------------------------------------------------------- */
function useReadAloud(text) {
  const [state, setState] = useState('idle'); /* idle | speaking | unsupported */
  const uttRef = useRef(null);

  useEffect(() => {
    let ok = false;
    try { ok = typeof window !== 'undefined' && 'speechSynthesis' in window; } catch (e) { ok = false; }
    if (!ok) setState('unsupported');
    return () => {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* nothing to do */ }
    };
  }, []);

  /* A different reading means the old utterance is stale. */
  useEffect(() => {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    setState((s) => (s === 'unsupported' ? s : 'idle'));
  }, [text]);

  function toggle() {
    if (state === 'unsupported') return;
    try {
      if (state === 'speaking') {
        window.speechSynthesis.cancel();
        setState('idle');
        return;
      }
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 0.95;
      u.onend = function () { setState('idle'); };
      u.onerror = function () { setState('idle'); };
      uttRef.current = u;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setState('speaking');
    } catch (e) {
      setState('unsupported');
    }
  }

  return [state, toggle];
}

export default function Passage({ r, back }) {
  const router = useRouter();
  const spoken = r.ref + '. ' + r.verses.map(function (v) { return v[1]; }).join(' ');
  const [voice, toggleVoice] = useReadAloud(spoken);

  /* -------------------------------------------------------------------
     SAY SOMETHING ABOUT THIS.

     ⚠️ sessionStorage, ONE SHOT, and the wall deletes the key the moment
     it reads it. It is not a draft store — it is a handoff between two
     pages, and if the member never arrives the key dies with the tab.

     ⚠️ It seeds the composer and does NOT post anything. Nobody's
     reading lands on the wall because they tapped a button on a page
     about being honest.

     🔴 It carries the REFERENCE, never the member's own words, because
     there are no member words on this page to carry.
     ------------------------------------------------------------------- */
  function talk() {
    try {
      window.sessionStorage.setItem('sb_wall_seed', r.ref + ' — ');
    } catch (e) {
      /* private mode, blocked storage: the wall still opens, just empty */
    }
    router.push('/wall');
  }

  return (
    <div className="rd-one">
      {back}

      <p className="rd-ref">{r.ref}</p>
      <h1 className="rd-title">
        <span className="rd-tmark" aria-hidden="true">{r.mark}</span>
        {r.title}
      </h1>
      <p className="rd-who">{r.who}</p>

      {/* ⚠️ Verse numbers are small and set apart rather than inline —
          inline superscripts turn prose into a lookup table, and the
          point is that somebody reads this like writing. */}
      <div className="rd-passage">
        {r.verses.map(function (v) {
          return (
            <p key={v[0]} className="rd-v">
              <span className="rd-vn" aria-hidden="true">{v[0]}</span>
              {v[1]}
            </p>
          );
        })}
      </div>

      <button
        type="button"
        className="rd-listen"
        data-on={voice === 'speaking' ? '1' : '0'}
        onClick={toggleVoice}
        disabled={voice === 'unsupported'}
      >
        <span aria-hidden="true">{voice === 'speaking' ? '■' : '▶'}</span>
        {voice === 'unsupported'
          ? 'Reading aloud is not available on this phone'
          : voice === 'speaking' ? 'Stop' : 'Read it to me'}
      </button>

      {/* ⭐ THE ENGINE. Every one of these is checkable against the
          passage printed directly above it. The day one becomes a hook
          instead of a fact, this becomes the thing it replaced. */}
      <div className="rd-nobody">
        <p className="rd-nlabel">What nobody tells you</p>
        <p className="rd-ntext">{r.nobody}</p>
      </div>

      <p className="rd-close">{r.close}</p>

      {/* ⭐ ONE LINE, AND NOWHERE TO ANSWER IT. A text box here would
          make the app the keeper of somebody's private inventory, and
          that is a thing that can be leaked, subpoenaed, or read by
          whoever picks up their phone. */}
      <div className="rd-ask">
        <p className="rd-asklabel">Something to sit with</p>
        <p className="rd-asktext">{r.question}</p>
        <p className="rd-asknote">There is nowhere to answer this. Nothing is saved.</p>
      </div>

      <button type="button" className="rd-talk" onClick={talk}>
        <span className="rd-talktext">
          <b>Say something about this</b>
          <span>Opens the wall with {r.ref} at the top of the box</span>
        </span>
        <span className="rd-talkarrow" aria-hidden="true">&rarr;</span>
      </button>

      <p className="rd-src">{TRANSLATION}</p>
      {/* 🔴 No tick, no "read", nothing recorded. You were never here. */}
    </div>
  );
}
