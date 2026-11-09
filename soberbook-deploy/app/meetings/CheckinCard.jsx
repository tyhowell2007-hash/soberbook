'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import './checkin.css';

/* =====================================================================
   ✓ "WENT TO A MEETING TODAY?" — 8 Nov 2026 (0202_meeting_checkins).

   From the "Three new features" prototype. One tap, honor system, no
   location — Sober Book never asks where you are. The meeting name is
   optional and only you ever see it.

   ⚠️ Until 0202 is run, the rpc fails: the card then shows nothing at all
   rather than a button that can't work. Order doesn't matter for safety.

   ⭐ Counts are framed as "this month" and "since you started" — never a
   streak. A streak punishes a missed day; this only ever adds up.
   ===================================================================== */
export default function CheckinCard() {
  const [state, setState] = useState(null);   // null = loading / unavailable
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [circle, setCircle] = useState(null);   // 0204: { total, goal, counting } while a challenge runs
  const [plus, setPlus] = useState(false);

  /* 🎯 0204 — the circle challenge. Only drawn while one is running; until
     0204 is run (or with no challenge) this stays null and nothing shows. */
  async function loadCircle() {
    const { data, error } = await browserClient().rpc('circle_challenge');
    if (error) return null;
    const r = Array.isArray(data) ? data[0] : data;
    const c = r && r.status === 'active' ? { total: r.total, goal: r.goal, counting: !!r.counting } : null;
    setCircle(c);
    return c;
  }

  useEffect(() => { loadCircle(); }, []);

  useEffect(() => {
    let live = true;
    browserClient().rpc('my_meeting_checkins').then(({ data, error }) => {
      if (!live || error) return;
      const r = Array.isArray(data) ? data[0] : data;
      if (!r) return;
      setState({ today: !!r.today, month: r.this_month || 0, total: r.total || 0 });
      if (r.today_name) setName(r.today_name);
    });
    return () => { live = false; };
  }, []);

  async function checkIn() {
    if (busy) return;
    setBusy(true); setErr('');
    const { data, error } = await browserClient().rpc('meeting_checkin', { p_name: name.trim() || null });
    setBusy(false);
    if (error) { setErr('That didn’t go through. Try again in a second.'); return; }
    const r = Array.isArray(data) ? data[0] : data;
    setState({ today: true, month: r?.this_month || 0, total: r?.total || 0 });
    const c = await loadCircle();
    if (c && c.counting) setPlus(true);
  }

  async function setCounting(on) {
    if (busy) return;
    setBusy(true);
    const { error } = await browserClient().rpc('set_circle_counting', { p_on: on });
    setBusy(false);
    if (!error) { setPlus(false); await loadCircle(); }
  }

  async function undo() {
    if (busy) return;
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('undo_meeting_checkin');
    setBusy(false);
    if (error) { setErr('Couldn’t take it back. Try again in a second.'); return; }
    setState((s) => s && { today: false, month: Math.max(0, s.month - 1), total: Math.max(0, s.total - 1) });
    setPlus(false);
    loadCircle();
  }

  if (!state) return null;

  return (
    <section className="mc-card" aria-label="Meeting check-in">
      <h2 className="mc-hd">{state.today ? 'You went to a meeting today.' : 'Went to a meeting today?'}</h2>

      {!state.today ? (
        <>
          <label className="mc-lab" htmlFor="mc-name">Which meeting <span>(optional, only you see it)</span></label>
          <input id="mc-name" className="mc-in" type="text" maxLength={80} value={name}
                 placeholder="Tuesday night Big Book" onChange={(e) => setName(e.target.value)} />
          <button type="button" className="mc-go" onClick={checkIn} disabled={busy}>
            {busy ? 'Checking in…' : '✓ I went to a meeting'}
          </button>
        </>
      ) : (
        <div className="mc-done">
          <p>Nice. That’s on the board.{name ? <> <b>{name}</b></> : null}</p>
          <button type="button" className="mc-undo" onClick={undo} disabled={busy}>Take it back</button>
        </div>
      )}

      {plus && circle && (
        <div className="mc-plus" role="status">
          <span className="mc-pc">+1</span>
          <span className="mc-pt"><b>Added to your circle</b><span>{Math.min(circle.total, circle.goal)} of {circle.goal} together</span>
            <i className="mc-pbar"><i style={{ width: Math.min(100, (circle.total / circle.goal) * 100) + '%' }} /></i></span>
        </div>
      )}

      <div className="mc-counts">
        <div><b>{state.month}</b><span>this month</span></div>
        <div><b>{state.total}</b><span>since you started</span></div>
      </div>
      {circle && (
        <div className="mc-circle">
          <span><b>Count mine toward my circle</b><span>Your circle has a challenge on. Only ever as a number. <a href="/circle">See it →</a></span></span>
          <button type="button" className="mc-tg" role="switch" aria-checked={circle.counting} disabled={busy}
                  aria-label="Count my check-ins toward my circle" onClick={() => setCounting(!circle.counting)} />
        </div>
      )}
      <p className="mc-note">Your word is enough. No location, and nobody else sees your check-ins.</p>
      {/* 0203 — the meeting slip lives on its own page. */}
      <a className="mc-slip" href="/slip">Need proof for court or your house? Get a signed meeting slip →</a>
      {err && <p className="mc-err" role="alert">{err}</p>}
    </section>
  );
}
