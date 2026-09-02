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
/* 🔴 NO DEFAULT CAMPAIGN, ON PURPOSE — 2 Sept.
   It used to be `campaign = 'survey'`, and page.jsx rendered `<Send />`
   with nothing. The buttons sent the survey under a heading and a
   warning describing the walkthrough email, for a day. A default is
   precisely how the label and the behaviour drift apart; lib/broadcasts.js
   refuses one for the same reason and says so in its own comment.
   ⚠️ Now a page that forgets to name a campaign renders a visible
   refusal instead of quietly mailing 182 people something. */
export default function Send({ campaign }) {
  if (!campaign) {
    return <p className="err">No campaign named. This page cannot send anything.</p>;
  }
  return <SendFor campaign={campaign} />;
}

function SendFor({ campaign }) {
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
          {/* 🔴 THE "IT COMES TO YOU" PROMISE IS NOW CONDITIONAL, AND IT HAD
              TO BE. It is only true while this campaign has sent NOBODY —
              Ty is the oldest account and broadcast_pending() is ordered by
              created_at, so the batch of one reaches him only on the very
              first press. After that the same button sends to a REAL
              MEMBER.

              ⚠️ It was written as an unconditional sentence and the comment
              underneath it said "this is only true while your row is
              unsent" — a warning to the reader of the code, doing nothing
              for the person pressing the button. On 1 Sept the walkthrough
              "test" went to a member because of exactly this, and on 2
              Sept the page was still saying "this campaign has sent nobody
              yet" with 26 already gone.

              ⭐ A caveat in a comment is not a safeguard. If the condition
              matters, it belongs in the condition. */}
          <button className="btn" type="button" disabled={busy} onClick={() => go(1)}>
            {busy ? 'Sending…' : (p.sent === 0 ? 'Send 1 — it comes to you' : 'Send 1')}
          </button>
          <p className="hint">
            {p.sent === 0 ? (
              <>You are the oldest account and this campaign has sent nobody yet, so
              the first one lands in your inbox. Look at it before sending the rest.</>
            ) : (
              <>This campaign is already part-sent, so this button goes to the next
              member in line &mdash; <b>not</b> to you.</>
            )}
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

      {/* 🔴 READS just* — NOT sent/failed/skipped. Those keys belong to
          the CAMPAIGN TOTAL now; the route used to overwrite the
          per-press counts with them by spreading progress last, so this
          line reported the running total and called it "Last press".
          ⚠️ On the first press of a campaign the two numbers are equal,
          which is why it read as correct for a whole send. */}
      {last && (
        <p className="hint">
          Last press: <b>{last.justSent}</b> sent
          {last.justFailed ? <>, <b>{last.justFailed}</b> bounced</> : null}
          {last.justSkipped ? <>, {last.justSkipped} already had it</> : null}.
        </p>
      )}
      {/* 🔴 SAY OUT LOUD THAT THE DAY IS FULL, not just that something
          errored. Without this the screen shows a small number and a
          Resend string, and the honest reading — "come back tomorrow,
          nobody was lost" — has to be inferred. */}
      {last?.stoppedByQuota && (
        <p className="hint">
          <b>Stopped &mdash; today&rsquo;s 100 emails are used up.</b> Nobody was
          skipped or marked bad; the rest are still waiting. Press again tomorrow.
        </p>
      )}
      {last?.errors?.length > 0 && (
        <p className="hint">Resend said: {last.errors.join(' · ')}</p>
      )}
      {err && <p className="hint bad">{err}</p>}
    </>
  );
}
