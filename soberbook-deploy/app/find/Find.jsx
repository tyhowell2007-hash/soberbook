'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   FINDING SOMEBODY.

   ⚠️ THERE IS NO LIST HERE UNTIL YOU TYPE. That is the design, not a
   loading state.

   The obvious build shows everybody on arrival and filters as you type.
   In this app that screen is a browsable directory of people in
   recovery — and `Building for Women.md` calls a scrollable list of
   vulnerable people the sharpest risk in the product. Two characters
   minimum, enforced in the database too, so search is a tool for
   finding somebody you already met rather than a way to go shopping.

   ⚠️ AND THERE ARE NO DAY COUNTS IN THESE RESULTS. The database returns
   the field, but a list of strangers sorted next to how new they are is
   exactly the newcomer-finder this app keeps refusing. Day counts live
   on a profile, where you have gone to look at one person on purpose.
   ===================================================================== */

export default function Find() {
  const supabase = browserClient();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(e) {
    e.preventDefault();
    const t = q.trim();
    if (t.length < 2) { setRows(null); return; }
    setBusy(true);
    const { data } = await supabase.rpc('search_members', { q: t });
    setRows(data || []);
    setBusy(false);
  }

  return (
    <div className="findwrap">
      <form className="findbar" onSubmit={run}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Handle, or a name if they allow it"
               aria-label="Search for a member"
               autoCapitalize="none" autoCorrect="off" spellCheck="false" />
        <button type="submit" className="btn" disabled={busy || q.trim().length < 2}>
          {busy ? '…' : 'Find'}
        </button>
      </form>

      <p className="hint findhint">
        Everyone can be found by their handle. People are only findable by
        their name if they turned that on themselves.
      </p>

      {rows !== null && rows.length === 0 && (
        <div className="empty">
          <div className="h">Nobody by that name.</div>
          <div className="p">
            Handles are exact-ish — try a bit of it. And plenty of people
            choose not to be findable by their name, which is their call.
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <ul className="findlist">
          {rows.map((r) => (
            <li key={r.handle}>
              <Link href={`/u/${r.handle}`} className="findrow">
                {r.display_avatar_photo
                  ? <span className="fav fav-photo" aria-hidden="true" />
                  : <span className="fav" aria-hidden="true">{r.display_avatar || '🌱'}</span>}
                <span className="fmeta">
                  <span className="fname">{r.display_name}</span>
                  <span className="fhandle">@{r.handle}</span>
                </span>
                {/* Friend count, public by Ty's call. No day count — see
                    the note at the top of this file.

                    ⚠️ 'pending' here also covers a request they ignored.
                    Search must not become the one screen that reveals
                    what the profile page deliberately hides. */}
                <span className="fcount">
                  {r.friend_state === 'friends'  ? 'friends'
                   : r.friend_state === 'pending'  ? 'requested'
                   : r.friend_state === 'incoming' ? 'asked you'
                   : r.friends === 1 ? '1 friend' : `${r.friends} friends`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
