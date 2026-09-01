'use client';

import { useRef, useState } from 'react';

/* =====================================================================
   THE WALKTHROUGH PLAYER.

   ⚠️ THE CHAPTER LIST IS GENERATED FROM tutorial-film/CHAPTERS3.txt,
   which is itself computed from the real duration of every rendered
   scene. It is not typed by hand. If the film is ever re-cut, these
   numbers move and this array has to be regenerated with it — a chapter
   link that lands 40 seconds off is worse than no chapter link, because
   the viewer assumes they misremembered rather than that we were wrong.
   ===================================================================== */
const CHAPTERS = [
  { t: 12,  at: '00:12', label: 'Signing up' },
  { t: 64,  at: '01:04', label: 'Your day count — and changing both numbers' },
  { t: 135, at: '02:15', label: 'One more day' },
  { t: 194, at: '03:14', label: 'The wall' },
  { t: 236, at: '03:56', label: 'Photos, video and links' },
  { t: 283, at: '04:43', label: 'Tagging people' },
  { t: 335, at: '05:35', label: 'Replies' },
  { t: 383, at: '06:23', label: 'Notifications' },
  { t: 442, at: '07:22', label: 'Chat' },
  { t: 458, at: '07:38', label: 'The Front Room' },
  { t: 512, at: '08:32', label: 'Meetings' },
  { t: 563, at: '09:23', label: 'Meeting rooms' },
  { t: 592, at: '09:52', label: 'Quiet' },
  { t: 633, at: '10:33', label: 'The readings' },
  { t: 679, at: '11:19', label: 'Your page and your song' },
  { t: 727, at: '12:07', label: 'Putting out a record' },
  { t: 761, at: '12:41', label: 'Reporting and blocking' },
];

export default function Player() {
  const vid = useRef(null);
  const [at, setAt] = useState(0);

  /* Tapping a chapter seeks AND plays. Seeking without playing leaves
     somebody staring at a paused frame wondering whether they broke it. */
  function go(t) {
    const v = vid.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => {});   /* a refused play is not an error worth showing */
  }

  /* Which chapter are we in? Last one whose start time has passed.
     ⚠️ Derived from the video's own clock on every timeupdate, never
     stored — two copies of "where are we" is the drift bug this project
     keeps re-learning. */
  const current = CHAPTERS.reduce((acc, c, i) => (at >= c.t ? i : acc), -1);

  return (
    <>
      {/* 🔴 NO autoPlay, and no `muted` to sneak past the autoplay block.
          Somebody may open this at 2am in a house full of sleeping
          people. It is a fourteen-minute film with a voice on it; it
          starts when a person decides it starts.

          ⚠️ preload="metadata", not "auto" — "auto" starts pulling 26MB
          the instant the page opens, on a phone, on cellular, for
          somebody who may only have come to read the chapter list. */}
      <video
        ref={vid}
        className="tvid"
        src="/tour.mp4"
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
      />

      <p className="tsec">What&apos;s in it</p>
      <ol className="tchaps">
        {CHAPTERS.map((c, i) => (
          <li key={c.t}>
            {/* ⚠️ .tct / .tcl / .tsel, not .tt / .tl / .on — all three of
                those already exist elsewhere in the app. `.tl` is the
                lifetime-total label added to /me this morning; reusing it
                here would have restyled a number on somebody's own page
                from a file about a video. Checked before writing, which is
                the only order that catches it. */}
            <button
              type="button"
              className={'tchap' + (i === current ? ' tsel' : '')}
              onClick={() => go(c.t)}
            >
              <span className="tct">{c.at}</span>
              <span className="tcl">{c.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
