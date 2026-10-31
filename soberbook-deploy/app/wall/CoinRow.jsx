'use client';

import Coin from '../components/Coin';
import { COIN, coinTotal, topKinds, myCoin } from '../../lib/coins';

/* =====================================================================
   THE COIN ROW UNDER A POST.  31 Oct 2026 (0195).

   Replaces the Support / Strength boxes (0149). Same two rules carried
   over from them, because they were right:

   🔴 NEVER SHOW A ZERO. "0 coins" under somebody's worst night is worse
   than no number at all. With no coins there is no count, just the
   button.

   🔴 ON YOUR OWN POST IT IS NOT A BUTTON TO SEND, it is the count — you
   cannot coin yourself (send_coin refuses), and the author is exactly the
   person who needs to see that people showed up. Tapping it opens who
   sent what, with their words.
   ===================================================================== */
export default function CoinRow({ post, onSend, onSee }) {
  const total = coinTotal(post);
  const kinds = topKinds(post);
  const mine = myCoin(post);

  const stack = kinds.length ? (
    <span className="coinstack" aria-hidden="true">
      {kinds.map((k) => <Coin key={k} kind={k} size={20} />)}
    </span>
  ) : null;

  if (post.is_mine) {
    if (!total) return null;
    return (
      <div className="coinrow">
        <button type="button" className="coincount mine" onClick={onSee}>
          {stack}
          <span>{total} {total === 1 ? 'coin' : 'coins'} · see who</span>
        </button>
      </div>
    );
  }

  return (
    <div className="coinrow">
      <button type="button" className={'coinsendbtn' + (mine ? ' on' : '')}
              aria-pressed={!!mine} onClick={onSend}>
        <Coin kind={mine || 'proud'} size={26} />
        <span>{mine ? `You sent ${COIN[mine]?.name || 'a coin'}` : 'Send a coin'}</span>
      </button>
      {total > 0 ? (
        <span className="coincount" aria-label={`${total} ${total === 1 ? 'coin' : 'coins'}`}>
          {stack}
          <span>{total}</span>
        </span>
      ) : null}
    </div>
  );
}
