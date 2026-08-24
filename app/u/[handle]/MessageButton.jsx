'use client';

import { useState } from 'react';
import { browserClient } from '../../../lib/supabase-browser';

/* THE WAY INTO A CONVERSATION.

   By handle, never by id. public_profiles deliberately does not carry
   anybody's uuid — the handle is the address — so start_thread() is the
   one thing in the app allowed to turn one into the other, and it does it
   inside the database and hands back only a thread id.

   ⚠️ If this failed, it failed the same way for four different reasons:
   no such handle, suspended account, they blocked you, you blocked them.
   The error is one sentence covering all four. Do not "improve" it by
   telling the person which — a harasser uses "that person blocked you" to
   work out which of their accounts still work. */
export default function MessageButton({ handle }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setBusy(true); setErr('');
    const supabase = browserClient();
    const { data, error } = await supabase.rpc('start_thread', { target_handle: handle });
    if (error || !data) { setBusy(false); setErr(error?.message || 'Couldn’t open that.'); return; }
    window.location.href = `/chat/${data}`;
  }

  return (
    <>
      <button className="btn" onClick={go} disabled={busy}>
        {busy ? 'Opening…' : 'Message'}
      </button>
      <p className="hint">
        Your first message arrives as a request. They accept it or they don’t.
      </p>
      {err && <div className="err">{err}</div>}
    </>
  );
}
