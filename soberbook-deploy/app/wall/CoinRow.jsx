'use client';

import Link from 'next/link';
import Coin from '../components/Coin';
import { COIN, myCoin } from '../../lib/coins';

/* =====================================================================
   THE ACTION ROW UNDER A POST.  31 Oct 2026 (0195, reshaped in 0196).

   The counts moved up into StatStrip (Seen · Coins · Replies). What is
   left here is the one thing to DO:

   · someone else's post — "Send a coin" (or "You sent Proud of you")
   · your own post — "How it's doing", only you ever see it. You cannot
     coin yourself (send_coin refuses), and the author is the person who
     needs to see who showed up.
   ===================================================================== */
export default function CoinRow({ post, onSend }) {
  const mine = myCoin(post);

  if (post.is_mine) {
    return (
      <div className="coinrow">
        <Link href={`/p/${post.id}/stats`} className="howbtn">📊 How it’s doing</Link>
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
    </div>
  );
}
