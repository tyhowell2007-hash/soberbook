'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Coin from './Coin';
import { COINS, COIN } from '../../lib/coins';

/* =====================================================================
   THE COINS ON YOUR OWN POST.  31 Oct 2026 (0195).

   Who sent which coin, and their words. Only ever opened on your own
   post, and my_post_coins() checks that in the database anyway — anybody
   else gets an empty list, not an error.

   ⭐ NAMES ARE SHOWN because sending a coin is choosing to be seen, the
   same as replying. Who WATCHED or SAW a post is never shown, to anybody.
   ===================================================================== */
function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function CoinList({ postId, onClose }) {
  const supabase = browserClient();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    supabase.rpc('my_post_coins', { p_post: postId }).then(({ data }) => {
      if (live) setRows(data || []);
    });
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { live = false; window.removeEventListener('keydown', onKey); };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = Object.fromEntries(COINS.map((c) => [c.kind, 0]));
  (rows || []).forEach((r) => { if (r.kind in counts) counts[r.kind] += 1; });
  const total = (rows || []).length;

  return (
    <>
      <div className="coinbg" onClick={onClose} />
      <div className="coinsheet coinlist" role="dialog" aria-modal="true" aria-labelledby="coinlist-h">
        <h3 id="coinlist-h">{total ? `${total} ${total === 1 ? 'coin' : 'coins'} sent to you` : 'Your coins'}</h3>

        {rows === null ? <p className="coinwait">Counting…</p> : null}

        {rows && total > 0 ? (
          <>
            <div className="coinkinds">
              {COINS.filter((c) => counts[c.kind] > 0)
                .sort((a, b) => counts[b.kind] - counts[a.kind])
                .map((c) => (
                  <div key={c.kind} className="coinkind">
                    <Coin kind={c.kind} size={26} /><span>{c.name}</span><b>{counts[c.kind]}</b>
                  </div>
                ))}
            </div>
            <ul className="coinwho">
              {rows.map((r, i) => (
                <li key={i}>
                  <Coin kind={r.kind} size={30} />
                  <div>
                    <p>
                      {r.who_handle
                        ? <Link href={`/u/${r.who_handle}`} className="coinwho-n">{r.who}</Link>
                        : <b>{r.who}</b>}
                      {r.note
                        ? <q>{r.note}</q>
                        : <span className="coinwho-k"> sent {COIN[r.kind]?.name || 'a coin'}</span>}
                    </p>
                    <span className="coinwho-t">{ago(r.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {rows && total === 0 ? (
          <p className="coinwait">No coins on this one yet. When somebody sends one, it shows up here with their words.</p>
        ) : null}

        <button type="button" className="cointake" onClick={onClose}>Close</button>
      </div>
    </>
  );
}
