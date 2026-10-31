'use client';

import Coin from '../components/Coin';
import { coinTotal, topKinds } from '../../lib/coins';

/* =====================================================================
   THE STAT STRIP — Seen (or Watched) · Coins · Replies.  31 Oct (0196).

   From prototype v3, approved. Same three boxes, same place, every post.

   🔴 NEVER A SAD NUMBER. Under 10, the first box says "New" instead of
   "3 seen" — nobody's first nervous post should be greeted by a small
   number. The author still sees the real count on "How it's doing".
   Coins and Replies boxes only appear once there is at least one; a
   zero is never drawn (the 0149 rule).

   ⭐ seen_count arrives NULL when the author switched the number off.
   Then the box says "Seen" / "Watched" with no number at all.
   ===================================================================== */
export default function StatStrip({ post, onCoins }) {
  const isVideo = !!(post.video_url || post.stream_uid);
  const word = isVideo ? 'Watched' : 'Seen';
  const seen = post.seen_count;
  const coins = coinTotal(post);
  const kinds = topKinds(post);
  const replies = Number(post.comment_count) || 0;
  const hidden = seen === null || seen === undefined;
  const n = Number(seen) || 0;

  return (
    <div className="statstrip">
      <div className="statcell">
        {hidden ? (
          <span className="statk solo">{word}</span>
        ) : n < 10 && !post.is_mine ? (
          <><span className="statnew">✨ New</span><span className="statk">Just shared</span></>
        ) : (
          <><b className="statv">{n.toLocaleString()}</b><span className="statk">{word}</span></>
        )}
      </div>
      {coins > 0 ? (
        post.is_mine && onCoins ? (
          <button type="button" className="statcell statbtn" onClick={onCoins}>
            <b className="statv">
              <span className="coinstack" aria-hidden="true">
                {kinds.map((k) => <Coin key={k} kind={k} size={18} />)}
              </span>
              {coins.toLocaleString()}
            </b>
            <span className="statk">Coins · see who</span>
          </button>
        ) : (
          <div className="statcell">
            <b className="statv">
              <span className="coinstack" aria-hidden="true">
                {kinds.map((k) => <Coin key={k} kind={k} size={18} />)}
              </span>
              {coins.toLocaleString()}
            </b>
            <span className="statk">Coins</span>
          </div>
        )
      ) : null}
      {replies > 0 ? (
        <div className="statcell">
          <b className="statv">{replies.toLocaleString()}</b>
          <span className="statk">{replies === 1 ? 'Reply' : 'Replies'}</span>
        </div>
      ) : null}
    </div>
  );
}
