'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   WHO CAN MESSAGE YOU — 0201, 13 Nov 2026.
   Prototype approved by Ty: claude.ai/artifact/APNJjjvmVugEWernHutYnu

   Everyone | Only friends. Somebody new (first 30 days) starts on Only
   friends without choosing it (Ty's call, 13 Nov). Whatever a member
   picks here always wins. start_thread() in the database is what
   actually enforces it, so this is a switch, not a promise.

   ⚠️ Same rule as EmailSwitch: trust the server, not a guess. Nothing
   moves until the database says it saved.
   ===================================================================== */
export default function DmFromSwitch() {
  const [s, setS] = useState(null);     // { value, newcomer, chosen }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    browserClient().rpc('my_dm_from').then(({ data }) => { if (data) setS(data); });
  }, []);

  async function pick(value) {
    if (!s || busy || (value === s.value && s.chosen)) return;
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('set_dm_from', { p_value: value });
    setBusy(false);
    if (error) { setErr('Couldn’t save that. Try again.'); return; }
    setS({ ...s, value, chosen: true });
  }

  if (!s) return null;   // say nothing rather than guess

  return (
    <div className="pushbox">
      <h3 className="pushh">Who can message you</h3>
      <button type="button" className={'dmf-opt' + (s.value === 'everyone' ? ' sel' : '')}
              aria-pressed={s.value === 'everyone'} disabled={busy} onClick={() => pick('everyone')}>
        <span className="dmf-radio" />
        <span><b>Everyone</b><small>Any member can send you a first message.</small></span>
      </button>
      <button type="button" className={'dmf-opt' + (s.value === 'friends' ? ' sel' : '')}
              aria-pressed={s.value === 'friends'} disabled={busy} onClick={() => pick('friends')}>
        <span className="dmf-radio" />
        <span><b>Only friends</b><small>Others can send you a friend request first.</small></span>
      </button>
      <p className="dmf-note">
        {s.newcomer && !s.chosen
          ? 'You’re in your first 30 days, so we started you on Only friends. Switch whenever you’re ready.'
          : s.value === 'friends'
            ? 'Only friends can send you a first message. Chats you already have keep working.'
            : 'Anyone can message you. You can switch back any time.'}
      </p>
      {err && <div className="err">{err}</div>}
    </div>
  );
}
