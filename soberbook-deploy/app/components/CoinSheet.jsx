'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import Coin from './Coin';
import { COINS, COIN, NOTE_MAX } from '../../lib/coins';

/* =====================================================================
   SEND A COIN — the sheet.  31 Oct 2026 (0195).

   Pick one of four coins, optionally add a few words, send. One coin per
   person per post: sending a different one swaps it, and "Take my coin
   back" removes it. send_coin() enforces all of that in the database;
   this sheet only asks.

   ⭐ THE WORDS ARE FOR ONE PERSON. They go to the member whose post it is
   and nobody else — the wall shows counts only. The hint under the box
   says so, because somebody typing "this got me out of bed today" needs
   to know who will read it.

   ⚠️ onDone(kind|null) is called only AFTER the database said yes. The
   wall does its own optimistic count; this sheet never pretends.
   ===================================================================== */
export default function CoinSheet({ postId, to, current = null, allowWords = true, onClose, onDone }) {
  const supabase = browserClient();
  const [pick, setPick] = useState(current);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const first = useRef(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    if (!pick || busy) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('send_coin', {
      p_post: postId, p_kind: pick, p_note: allowWords ? (note.trim() || null) : null,
    });
    setBusy(false);
    if (error) { setErr('That coin didn’t go through. Try again in a moment.'); return; }
    onDone(pick);
  }

  async function takeBack() {
    if (busy) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('take_back_coin', { p_post: postId });
    setBusy(false);
    if (error) { setErr('Couldn’t take it back just now. Try again in a moment.'); return; }
    onDone(null);
  }

  return (
    <>
      <div className="coinbg" onClick={onClose} />
      <div className="coinsheet" role="dialog" aria-modal="true" aria-labelledby="coinsheet-h">
        <h3 id="coinsheet-h">Send a coin</h3>
        {to ? <p className="coinsheet-to">to {to}</p> : null}

        <div className="coinfan" role="radiogroup" aria-label="Pick a coin">
          {COINS.map((c, i) => (
            <button key={c.kind} type="button" role="radio" aria-checked={pick === c.kind}
                    ref={i === 0 ? first : undefined}
                    className={'coinpick' + (pick === c.kind ? ' on' : '')}
                    onClick={() => setPick(c.kind)}>
              <Coin kind={c.kind} size={46} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        {/* 0196 — the author can switch coin words off for a post. */}
        {allowWords ? (
          <>
            <label className="coinwords-l" htmlFor="coinwords">Add a few words (optional)</label>
            <input id="coinwords" className="coinwords" maxLength={NOTE_MAX}
                   value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="You’ve got this." autoComplete="off" />
            <p className="coinwords-n">{note.length}/{NOTE_MAX} · only they see this</p>
          </>
        ) : null}

        {err ? <p className="coinerr" role="alert">{err}</p> : null}

        <button type="button" className="coinsend" disabled={!pick || busy} onClick={send}>
          {busy ? 'Sending…' : pick ? `Send ${COIN[pick].name}` : 'Pick a coin'}
        </button>
        {current ? (
          <button type="button" className="cointake" disabled={busy} onClick={takeBack}>
            Take my coin back
          </button>
        ) : null}
        <p className="coinfree">Coins are free and can never be bought.</p>
      </div>
    </>
  );
}
