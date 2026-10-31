'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import Coin from './Coin';
import { COINS } from '../../lib/coins';

/* =====================================================================
   THE COIN SHELF.  31 Oct 2026 (0195).

   Every coin ever sent to a member, counted by kind. Counts only, never
   names.

   ⭐ OFF BY DEFAULT, AND THE OWNER DECIDES. On your own page you see your
   shelf and a switch; on somebody else's page it appears only if they
   switched it on. coin_shelf() decides all of that in the database and
   returns null when there is nothing you may see — this component just
   draws what it is given, and draws NOTHING for null or an empty shelf
   on someone else's page.

   🔴 Somebody else's shelf counts their NON-ANONYMOUS posts only, so a
   shelf can never total up the coins on an anonymous post and point at
   who wrote it.
   ===================================================================== */
export default function CoinShelf({ handle, mine = false }) {
  const supabase = browserClient();
  const [shelf, setShelf] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    supabase.rpc('coin_shelf', { p_handle: handle }).then(({ data, error }) => {
      if (live && !error) setShelf(data || null);
    });
    return () => { live = false; };
  }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shelf) return null;
  const total = Number(shelf.total) || 0;
  if (!mine && total === 0) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const want = !shelf.public;
    const { error } = await supabase.rpc('set_coin_shelf_public', { p_on: want });
    setBusy(false);
    if (!error) setShelf({ ...shelf, public: want });
  }

  return (
    <section className="coinshelf" aria-label="Coin shelf">
      <h2 className="sec">Coin shelf{total ? ` · ${total}` : ''}</h2>
      {total === 0 ? (
        <p className="hint">Coins people send you land here.</p>
      ) : (
        <div className="coinshelf-row">
          {COINS.map((c) => (
            <div key={c.kind} className={'coinshelf-c' + (Number(shelf[c.kind]) ? '' : ' none')}>
              <Coin kind={c.kind} size={44} />
              <b>{Number(shelf[c.kind]) || 0}</b>
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      )}
      {mine ? (
        <label className="coinshelf-sw">
          <input type="checkbox" checked={!!shelf.public} disabled={busy} onChange={toggle} />
          <span>Show my coin shelf on my profile</span>
          <small>{shelf.public ? 'Members can see your counts. Never who sent them.' : 'Off: only you can see it.'}</small>
        </label>
      ) : null}
    </section>
  );
}
