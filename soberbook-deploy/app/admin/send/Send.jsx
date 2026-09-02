'use client';

import { useEffect, useState } from 'react';

/* =====================================================================
   THE SEND BUTTON.

   ⭐ THE FIRST PRESS SENDS ONE, AND IT GOES TO TY. He is the oldest
   profile and broadcast_pending() is ordered by created_at, so the
   batch of one lands in his own inbox — through the identical code
   path as the other 145. Deliberately not a "test mode": a test that
   takes a different path proves nothing about the real one, which is
   the lesson from the Daily room in August (verified the join screen,
   never clicked Join).

   ⚠️ Nothing here can send twice. The database refuses it (0109). This
   page is a trigger, not a safety mechanism.
   ===================================================================== */
export default function Send({ campaign = 'survey' }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState('');

  async function refresh() {
    const r = await fetch(`/api/admin/broadcast?campaign=${campaign}`, { cache: 'no-store' });
    setP(r.ok ? await r.json() : null);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [campaign]);

  async function go(limit) {
    setBusy(true); setErr(''); setLast(null);
    try {
      const r = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, campaign }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setLast(j); setP(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <p className="hint">Reading the numbers…</p>;

  const done = p.remaining === 0;

  return (
    <>
      <div className="sndrow">
        <div className="sndbox"><b>{p.eligible}</b><span>on the list</span></div>
        <div className="sndbox"><b>{p.sent}</b><span>sent</span></div>
        <div className="sndbox"><b>{p.remaining}</b><span>to go</span></div>
        {p.failed > 0 && <div className="sndbox bad"><b>{p.failed}</b><span>bounced</span></div>}
      </div>

      {done ? (
        <p className="hint">Everybody on the list has had it. Pressing again does nothing.</p>
      ) : (
        <>
          {/* ⚠️ ONE first, and it is not optional politeness — it is the
              only way to see the real email before 145 other people do.
              The button for the rest stays available either way; this is
              a recommendation, not a lock, because Ty is the boss. */}
          <button className="btn" type="button" disabled={busy} onClick={() => go(1)}>
            {busy ? 'Sending…' : 'Send 1 — it comes to you'}
          </button>
          <p className="hint">
            You are the oldest account and this campaign has sent nobody yet, so
            the first one lands in your inbox. Look at it before sending the rest.
            {/* ⚠️ This is only true while YOUR row for this campaign is unsent.
                On 1 Sept it was repeated after Ty had already been sent to, and
                the "test" went to a real member instead. It holds here because
                'survey' is a brand-new broadcast key with zero rows. */}
          </p>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => go(25)}>
            Send the next 25
          </button>
          <p className="hint">
            Resend&apos;s free tier is 100 a day. Nobody can get two &mdash; the
            database refuses it &mdash; so press it again tomorrow and it picks
            up where it stopped.
          </p>
        </>
      )}

      {last && (
        <p className="hint">
          Last press: <b>{last.sent}</b> sent
          {last.failed ? <>, <b>{last.failed}</b> bounced</> : null}
          {last.skipped ? <>, {last.skipped} already had it</> : null}.
        </p>
      )}
      {last?.errors?.length > 0 && (
        <p className="hint">Resend said: {last.errors.join(' · ')}</p>
      )}
      {err && <p className="hint bad">{err}</p>}
    </>
  );
}
