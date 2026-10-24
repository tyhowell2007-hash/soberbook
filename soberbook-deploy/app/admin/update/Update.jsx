'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../../lib/supabase-browser';
import './update.css';

const MAX = 800;

/* =====================================================================
   THE ONE BOX. 24 Oct (0191).

   Ty and Matt post from here, signed in as themselves. There is no
   Sober Book login, so there is no password for two people to share and
   no account for either of them to be locked out of. The database
   records which admin wrote each note; members never see that.

   ⚠️ ONE PIN AT A TIME IS NOT ENFORCED IN THIS FILE. post_team_update()
   clears the live one in the same statement that writes the new one.
   Doing it here as two calls would leave a window where the wall has
   two notices or none, and a window like that eventually opens.
   ===================================================================== */
export default function Update({ live }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const [said, setSaid] = useState('');

  const left = MAX - body.length;

  async function post() {
    const text = body.trim();
    if (!text) { setErr('Nothing to post yet.'); return; }
    setBusy(true); setErr(''); setSaid('');
    const { error } = await browserClient().rpc('post_team_update', { p_body: text });
    setBusy(false);
    if (error) {
      /* Say what the database said. "Couldn't post" sends somebody to
         press the identical button again, which is the one action
         guaranteed not to help. */
      setErr(`That didn’t post — ${error.message}.`);
      return;
    }
    setBody('');
    setSaid('Posted. It’s at the top of the wall now.');
    router.refresh();
  }

  async function clear() {
    setBusy(true); setErr(''); setSaid('');
    const { error } = await browserClient().rpc('clear_team_update');
    setBusy(false);
    if (error) { setErr(`That didn’t clear — ${error.message}.`); return; }
    setSaid('Taken down. The wall has no notice on it now.');
    router.refresh();
  }

  return (
    <div className="tuadmin">
      <h2>What’s pinned right now</h2>
      {live
        ? (
          <div className="tucur">
            <p className="tucurbody">{live.body}</p>
            <button type="button" className="btn ghost" disabled={busy}
                    onClick={clear}>Take it down</button>
          </div>
        )
        : <p className="hint">Nothing. The wall has no notice on it.</p>}

      <h2>Post a new one</h2>
      <p className="hint">
        It goes up as Sober Book with the official seal, above everybody’s feed,
        and it stays there until you replace it or take it down. Posting a new one
        replaces whatever is up — there is only ever one.
      </p>

      <label className="fld" htmlFor="tu">The update</label>
      <textarea id="tu" value={body} maxLength={MAX} disabled={busy}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What changed, in plain words…" />
      <p className="hint">{left} characters left</p>

      <div className="row">
        <button type="button" className="btn" disabled={busy || !body.trim()}
                onClick={post}>{busy ? 'Posting…' : 'Post the update'}</button>
      </div>

      {err  && <p className="gerr" role="alert">{err}</p>}
      {said && <p className="hint" role="status">{said}</p>}

      <p className="hint">
        No notification goes out. People see it next time they open the wall —
        which is the right volume for “we shipped something”. An outage is worth
        waking 449 phones for; a feature is not.
      </p>
    </div>
  );
}
