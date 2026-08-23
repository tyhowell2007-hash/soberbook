'use client';

import { useState } from 'react';

/* =====================================================================
   SOMETHING TO WATCH, SITTING ON THE WALL.

   ---------------------------------------------------------------------
   🔴 NOTHING LOADS UNTIL SOMEBODY TAPS PLAY.

   Same rule as Linked.jsx and SongPlayer.jsx, third place it applies. An
   iframe fires the instant the page renders, so a wall carrying eight of
   these would announce this member's browser to Google eight times over
   before they had touched anything.

   ⚠️ And the thumbnail is served from OUR bucket, not from i.ytimg.com —
   that is the whole reason the puller downloads and re-encodes it. A
   picture is a request too. Getting the iframe right and leaving the
   image pointing at Google would have leaked exactly the same thing,
   quietly, on every single page load.

   ---------------------------------------------------------------------
   ⚠️ THE SOURCE IS ALWAYS ON THE CARD.

   Not decoration. In a room where treatment centres pay for referrals,
   somebody has to be able to see where a thing came from before they tap
   it — and this feed is curated by us, which makes it MORE our
   responsibility to say whose voice it is, not less.

   ⚠️ The category chip says 'talk' for the general-interest shows rather
   than 'recovery'. Putting "recovery" on a card is the app making a claim
   about somebody's recovery. It only says that where it's true.
   ===================================================================== */

const CHIP = {
  comedy:   '😂 comedy',
  music:    '🎧 music',
  recovery: '🌱 recovery',
  calm:     '🌊 calm',
  local:    '📍 ohio',
  talk:     '🎙️ talk',
};

export default function ContentCard({ item, thumbBase }) {
  const [on, setOn] = useState(false);
  if (!item) return null;

  const thumb = item.thumb_path ? `${thumbBase}/${item.thumb_path}` : null;

  return (
    <article className="cc">
      <div className="cchd">
        <span className="ccsrc">{item.source_label}</span>
        <span className="cccat">{CHIP[item.category] || item.category}</span>
      </div>

      <div className="ccframe">
        {on && item.embed_id ? (
          <iframe
            className="ccif"
            src={`https://www.youtube-nocookie.com/embed/${item.embed_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={item.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            /* ⚠️ Not no-referrer — YouTube refuses an embed that arrives
               with no origin at all. This is the tightest setting they
               accept: they learn the site, never the page or the member. */
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="ccplay"
                  onClick={() => setOn(true)}
                  aria-label={`Play: ${item.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumb ? <img className="ccimg" src={thumb} alt="" loading="lazy" /> : <span className="ccimg ccnone" />}
            <span className="ccbtn" aria-hidden="true">▶</span>
            <span className="ccnote">nothing loads until you tap</span>
          </button>
        )}
      </div>

      <p className="cctitle">{item.title}</p>

      {/* ⚠️ no-referrer on the way OUT, unlike the embed above. Opening the
          link in a new tab has no such requirement, so it gets the strict
          rule the rest of the app uses for member-facing links. */}
      <a className="ccout" href={item.url} target="_blank"
         rel="noopener noreferrer" referrerPolicy="no-referrer">
        open on youtube ↗
      </a>
    </article>
  );
}
