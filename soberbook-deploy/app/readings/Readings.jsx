'use client';

import Link from 'next/link';
import Passage from './Passage';

/* =====================================================================
   THE PARTS NOBODY PREACHES — the screen.  Rebuilt 26 Sept 2026.

   Was: a list of six, tap one to read it, forever the same six.
   Now: today's reading opens the page, and the other 129 are underneath
   in a library you can wander into whenever you want.

   ⭐ TODAY'S IS THE PAGE, NOT AN ITEM ON IT. Ty asked for the reading to
   change every day; burying it under a list would mean a member has to
   go looking for the thing that changed. The library comes second.

   ⚠️ THE FULL TEXT OF THE OTHER 129 IS NOT IN THIS COMPONENT. `index`
   is id, mark, ref, title, who — about 13KB. The passages are 120KB and
   are fetched by /readings/[id] when somebody actually opens one. This
   is the difference between a page that loads on a bad connection in a
   parking lot and one that does not.

   🔴 NOTHING IS STORED. No "read today", no streak, no count. The page
   cannot tell you whether you opened it yesterday, and that is the
   feature.
   ===================================================================== */

export default function Readings({ today, index }) {
  return (
    <div className="rd-wrap">
      <p className="rd-kicker">Today&rsquo;s reading</p>

      <Passage r={today} />

      <div className="rd-libhead">
        <h2 className="rd-h2">All of them</h2>
        <p className="rd-libnote">
          {/* ⚠️ The number is read off the array, never typed. A hard-coded
              "130" is wrong the first time anybody adds one. */}
          {index.length} readings. A different one every day, the same one for
          everybody. Nothing here is out of reach &mdash; open any of them
          whenever you want.
        </p>
      </div>

      <ul className="rd-list">
        {index.map(function (r) {
          return (
            <li key={r.id}>
              <Link href={'/readings/' + r.id} className="rd-item">
                {/* ⚠️ aria-hidden. Every mark is an object from its own
                    passage, so a screen reader announcing "loaf of bread"
                    before "He asked God to kill him" would be baffling at
                    best. The title already says everything. */}
                <span className="rd-mark" aria-hidden="true">{r.mark}</span>
                <span className="rd-itext">
                  <span className="rd-iref">{r.ref}</span>
                  <span className="rd-ititle">{r.title}</span>
                  <span className="rd-iwho">{r.who}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ⚠️ Said here rather than nowhere. Somebody who doesn't believe
          any of this should know within one sentence that the page
          isn't going to work on them — and somebody who does believe
          should know it isn't a church trying to recruit them either. */}
      <p className="rd-foot">
        Nobody has to believe any of this. It&rsquo;s here because a lot of
        people in recovery were handed a sanded-down version of it, and
        the real thing is rougher and more use.
      </p>

      <Link href="/quiet" className="rd-out">&larr; back to Quiet</Link>
    </div>
  );
}
