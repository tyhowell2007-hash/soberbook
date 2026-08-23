'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { READINGS, TRANSLATION } from './texts';

/* =====================================================================
   THE PARTS NOBODY PREACHES — the screen.

   ⭐ THE FLYER TREATMENT, AND IT IS THE ONE PLACE IN THE APP THAT ISN'T
   THE GREEN ROOM. Ty picked it: black ink on newsprint, the verse set
   big and hard like a lyric sheet. That IS the brand — the posters and
   the printed flyer are 90s xerox punk — it just hasn't been inside the
   app before.

   ⚠️ The BOTTOM NAV STAYS GREEN. The layout still imports theme-green,
   and every class in here is prefixed rd-. A page that looks different
   reads as deliberate; a page where the navigation ALSO changes reads
   as broken.

   🔴 NOTHING IS STORED. No plan, no "day 3 of 30", no progress bar, no
   tick when you finish one. There is no table for this feature and no
   API call in this file. A plan you're behind on is a streak wearing a
   robe, and it punishes the week somebody couldn't.
   ===================================================================== */

function One({ r, onBack }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="rd-one">
      <button type="button" className="rd-back" onClick={onBack} ref={ref}>
        ← all of them
      </button>

      <p className="rd-ref">{r.ref}</p>
      <h1 className="rd-title">{r.title}</h1>
      <p className="rd-who">{r.who}</p>

      {/* The passage. ⚠️ Verse numbers are small and set apart rather
          than inline — inline superscripts turn prose into a lookup
          table, and the point is that somebody reads this like writing,
          not like a reference. */}
      <div className="rd-passage">
        {r.verses.map(([n, text]) => (
          <p key={n} className="rd-v">
            <span className="rd-vn" aria-hidden="true">{n}</span>
            {text}
          </p>
        ))}
      </div>

      {/* ⭐ THE ENGINE. Every one of these is checkable against the
          passage printed directly above it. The day one becomes a hook
          instead of a fact, this becomes the thing it replaced. */}
      <div className="rd-nobody">
        <p className="rd-nlabel">What nobody tells you</p>
        <p className="rd-ntext">{r.nobody}</p>
      </div>

      <p className="rd-close">{r.close}</p>

      <p className="rd-src">{TRANSLATION}</p>

      <button type="button" className="rd-done" onClick={onBack}>
        Done
      </button>
      {/* 🔴 No tick, no "1 of 6 read", nothing recorded. You tapped Done
          and the app has no memory that you were ever here. */}
    </div>
  );
}

export default function Readings() {
  const [open, setOpen] = useState(null);

  if (open) return <One r={open} onBack={() => setOpen(null)} />;

  return (
    <div className="rd-wrap">
      <p className="rd-kicker">The parts nobody preaches</p>
      <h1 className="rd-h1">Six of them</h1>
      <p className="rd-lede">
        Not the verses on the fridge magnet. The ones where the person in
        the story is in the state you’re in.
      </p>

      <ul className="rd-list">
        {READINGS.map((r) => (
          <li key={r.id}>
            <button type="button" className="rd-item" onClick={() => setOpen(r)}>
              <span className="rd-iref">{r.ref.split(':')[0]}</span>
              <span className="rd-ititle">{r.title}</span>
              <span className="rd-iwho">{r.who}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* ⚠️ Said here rather than nowhere. Somebody who doesn't believe
          any of this should know within one sentence that the page
          isn't going to work on them — and somebody who does believe
          should know it isn't a church trying to recruit them either. */}
      <p className="rd-foot">
        Nobody has to believe any of this. It’s here because a lot of
        people in recovery were handed a sanded-down version of it, and
        the real thing is rougher and more use.
      </p>

      <Link href="/quiet" className="rd-out">← back to Quiet</Link>
    </div>
  );
}
