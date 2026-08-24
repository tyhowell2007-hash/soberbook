'use client';

import { useState } from 'react';
import { pieces, classify, firstPlayable, host } from '../../lib/links';

/* =====================================================================
   A BODY WITH LINKS IN IT, AND A PLAYER IF ONE FITS.

   Ty, Aug 23: a member posted his music and the link came out as plain
   text. "We need to be able to access that music right in sober book
   without copy and pasting it and going outside."

   ---------------------------------------------------------------------
   🔴 THE THREE RULES ON EVERY OUTBOUND LINK, AND WHY.

   1. referrerPolicy="no-referrer" — the destination is never told the
      visitor came from soberbook.app. For a normal site that's a
      statistic; here it discloses that the person clicking is in
      recovery, to a stranger, permanently, in their server logs.
   2. rel="noopener noreferrer nofollow ugc" — noopener stops the opened
      page reaching back into this one; ugc/nofollow say plainly that a
      member wrote this, not us.
   3. THE DOMAIN IS ALWAYS SHOWN. A person should be able to see where a
      link goes before they tap it. In a room where treatment centres pay
      for referrals, an unlabelled link is how somebody gets sold.

   ---------------------------------------------------------------------
   ⚠️ THE PLAYER DOES NOT LOAD UNTIL SOMEBODY TAPS PLAY.

   Same rule as SongPlayer.jsx, same reason: an iframe loads the moment
   the page does, so scrolling past a post would announce this browser to
   Google or Spotify before a note played. Not an acceptable default on
   this app.

   ⚠️ ONE PLAYER PER BODY. Five links must not become five players that
   all start at once.
   ===================================================================== */

function Out({ url }) {
  const h = host(url);
  return (
    <a className="lk" href={url} target="_blank"
       rel="noopener noreferrer nofollow ugc"
       referrerPolicy="no-referrer">
      {url.length > 48 ? url.slice(0, 45) + '…' : url}
      <span className="lkh"> {h}</span>
    </a>
  );
}

export function Body({ text }) {
  if (!text) return null;
  return (
    <>
      {pieces(text).map((p, i) =>
        p.t === 'link' ? <Out key={i} url={p.v} /> : <span key={i}>{p.v}</span>
      )}
    </>
  );
}

export function Player({ text }) {
  const [on, setOn] = useState(false);
  const c = firstPlayable(text);
  if (!c) return null;

  return (
    <div className={'ply' + (c.tall ? ' tall' : '')}>
      {on ? (
        <iframe
          className="plyf"
          src={c.embed}
          title={`${c.service} player`}
          allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
          allowFullScreen
          /* ⚠️ Not no-referrer here — YouTube and Spotify both refuse to
             play an embed that arrives with no origin at all. This is the
             tightest setting they accept: they learn the site, never the
             page or the member. */
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="plyb" onClick={() => setOn(true)}>
          <span className="plyt">▶</span>
          <span className="plyl">
            Play on {c.service}
            {/* ⭐ Says out loud that nothing has loaded yet. The honesty
                is the feature — this is an app that tells you before it
                talks to anybody else on your behalf. */}
            <span className="plys">nothing loads until you tap</span>
          </span>
        </button>
      )}
    </div>
  );
}
