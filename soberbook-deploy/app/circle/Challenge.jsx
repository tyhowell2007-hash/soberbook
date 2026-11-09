'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import './challenge.css';

/* =====================================================================
   🎯 CIRCLE CHALLENGE — 9 Nov 2026 (0204_circle_challenges).
   From the "Circle challenge, premium" prototype. Ty: "perfect! ship it".

   One shared goal for the circle ("40 meetings between us"). Every
   meeting check-in from anyone in the circle fills one ring. When it's
   full, EVERY member gets a circle coin.

   🔴 NO RANKINGS, NO NAMES. circle_challenge() only ever returns totals.
   🔴 NO "FAIL". A challenge that runs out of time says how many meetings
      the circle went to together, and offers another.
   ⚠️ Until 0204 is run the rpc fails and this draws NOTHING, so the
      circle page looks exactly like it did before.
   ===================================================================== */

const GOALS = [20, 30, 40, 60];
const R = 92;
const CIRC = 2 * Math.PI * R;

function day(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function short(dt) { return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function daysBetween(a, b) { return Math.round((day(b) - day(a)) / 86400000); }

function lengths() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const add = (n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d; };
  const eom = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  const leftInMonth = Math.round((eom - t) / 86400000) + 1;
  const out = [{ key: '2w', label: '2 weeks', ends: add(13) }];
  // "This month" only makes sense with some month left; otherwise 4 weeks.
  if (leftInMonth >= 10) out.push({ key: 'month', label: 'This month', ends: eom });
  else out.push({ key: '4w', label: '4 weeks', ends: add(27) });
  return out;
}

function hint(goal, people) {
  const n = Math.max(2, people || 9);
  const lo = Math.floor(goal / n), hi = Math.ceil(goal / n);
  const each = lo === hi ? `About ${lo} each.` : `About ${lo} or ${hi} each.`;
  if (goal <= 20) return [each, 'A nice easy start.'];
  if (goal >= 60) return [each, 'A big one. Make sure the circle is up for it.'];
  return [each, 'Start small; you can always go bigger next time.'];
}

function Ring({ total, goal }) {
  const p = Math.min(1, goal ? total / goal : 0);
  const marks = [1, 2, 3, 4].map((k) => Math.round((goal * k) / 4));
  const ticks = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI;
    ticks.push(<line key={i} className="cc-tick" x1={110 + 74 * Math.cos(a)} y1={110 + 74 * Math.sin(a)}
                     x2={110 + 79 * Math.cos(a)} y2={110 + 79 * Math.sin(a)} strokeWidth={i % 10 ? 1 : 2} />);
  }
  return (
    <div className="cc-ring" role="img" aria-label={`${total} of ${goal} meetings`}>
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <defs><linearGradient id="ccg" x1="0" x2="1"><stop offset="0" stopColor="#00C84A" /><stop offset="1" stopColor="#3BFF66" /></linearGradient></defs>
        <circle className="cc-trk" cx="110" cy="110" r={R} fill="none" strokeWidth="14" />
        <g>{ticks}</g>
        <circle className="cc-arc" cx="110" cy="110" r={R} fill="none" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p)} />
      </svg>
      <div className="cc-ctr"><div><b>{total}</b><span>OF {goal}</span></div></div>
      {marks.map((v, i) => {
        const a = ((i + 1) / 4) * 2 * Math.PI - Math.PI / 2;
        return (
          <div key={i} className={'cc-ms' + (total >= v ? ' hit' : '')}
               style={{ left: `${((110 + R * Math.cos(a)) / 220) * 100}%`, top: `${((110 + R * Math.sin(a)) / 220) * 100}%` }}>{v}</div>
        );
      })}
    </div>
  );
}

function Confetti() {
  const cols = ['#3BFF66', '#E8B53A', '#FFFFFF', '#FFE08A', '#6F80FF'];
  return (
    <div className="cc-conf" aria-hidden="true">
      {Array.from({ length: 36 }).map((_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % 5], animationDelay: `${(i * 0.23) % 2.6}s` }} />
      ))}
    </div>
  );
}

export default function Challenge() {
  const supa = useRef(browserClient()).current;
  const [ch, setCh] = useState(undefined);   // undefined = loading, null = none / unavailable
  const [ok, setOk] = useState(false);       // false until the rpc answers (0204 run)
  const [coins, setCoins] = useState([]);
  const [form, setForm] = useState(false);
  const [goal, setGoal] = useState(40);
  const [len, setLen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [party, setParty] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([supa.rpc('circle_challenge'), supa.rpc('my_circle_coins')]);
    if (a.error) { setOk(false); setCh(null); return; }
    setOk(true);
    const r = Array.isArray(a.data) ? a.data[0] : a.data;
    setCh(r || null);
    setCoins(b.error ? [] : (b.data || []));
    // confetti once per challenge, per device
    if (r?.status === 'reached') {
      try {
        const k = 'sb-cc-seen-' + r.id;
        if (!localStorage.getItem(k)) { setParty(true); localStorage.setItem(k, '1'); }
      } catch { /* private window: no confetti memory, fine */ }
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (!ok || ch === undefined) return null;

  const opts = lengths();
  const pick = len || opts[opts.length - 1].key;
  const chosen = opts.find((o) => o.key === pick) || opts[0];

  async function start() {
    if (busy) return;
    setBusy(true); setErr('');
    const { data, error } = await supa.rpc('start_circle_challenge', { p_goal: goal, p_len: chosen.key });
    setBusy(false);
    if (error) { setErr('That didn’t go through. Try again in a second.'); return; }
    if (data === 'running') setErr('Someone in your circle just started one.');
    setForm(false);
    await load();
  }
  function talk() {
    const box = document.querySelector('.cir-box');
    if (box) { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.focus(); }
  }

  const coinCase = coins.length > 0 && (
    <div className="cc-glass">
      <div className="cc-lab">Your circle coins</div>
      <div className="cc-case">
        {coins.slice(0, 8).map((c, i) => (
          <div key={i} className="cc-mini" title={`${c.goal} together · ${short(day(c.ends_on))}`}><b>{c.goal}</b></div>
        ))}
      </div>
      <p className="cc-small">One for every challenge your circle finished together.</p>
    </div>
  );

  /* ---------- START FORM ---------- */
  if (form) {
    const [h1, h2] = hint(goal, ch?.people);
    return (
      <section className="cc-wrap" aria-label="Start a circle challenge">
        <div><div className="cc-eyebrow">For your whole circle</div><h2 className="cc-big">Start a circle challenge</h2></div>
        <p className="cc-p">One goal for all of you. Everyone’s meeting check-ins add up toward it.</p>
        <div className="cc-lab">Meetings, all together</div>
        <div className="cc-opts">
          {GOALS.map((g) => (
            <button key={g} type="button" className="cc-opt cc-num" aria-pressed={goal === g} onClick={() => setGoal(g)}>{g}</button>
          ))}
        </div>
        <div className="cc-lab">For how long</div>
        <div className="cc-opts cc-two">
          {opts.map((o) => (
            <button key={o.key} type="button" className="cc-opt" aria-pressed={pick === o.key} onClick={() => setLen(o.key)}>
              {o.label}<small>ends {short(o.ends)}</small>
            </button>
          ))}
        </div>
        <div className="cc-hint"><span aria-hidden="true">💡</span><span><b>{h1}</b> {h2}</span></div>
        <button type="button" className="cc-go" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start it'}</button>
        <button type="button" className="cc-ghost" onClick={() => setForm(false)}>Not now</button>
        <p className="cc-small">Your circle gets one message from you saying it started. If time runs out, it just shows how many meetings you went to together.</p>
        {err && <p className="cc-err" role="alert">{err}</p>}
      </section>
    );
  }

  const old = ch && ch.status !== 'active' && daysBetween(ch.ends_on, ch.today) > 14;

  /* ---------- NO CHALLENGE ---------- */
  if (!ch || old) {
    return (
      <>
        <section className="cc-wrap cc-invite" aria-label="Circle challenge">
          <div className="cc-ph"><span className="cc-tag">CIRCLE CHALLENGE</span></div>
          <h2 className="cc-big">Set a goal together</h2>
          <p className="cc-p">Pick a number of meetings for the whole circle. Every check-in fills one ring. Get there and everyone gets a coin. No rankings, ever.</p>
          <button type="button" className="cc-go" onClick={() => setForm(true)}>Start a circle challenge</button>
          {err && <p className="cc-err" role="alert">{err}</p>}
        </section>
        {coinCase}
      </>
    );
  }

  /* ---------- REACHED ---------- */
  if (ch.status === 'reached') {
    const spare = Math.max(0, daysBetween(ch.reached_on || ch.today, ch.ends_on));
    return (
      <>
        <section className="cc-win" aria-label="Circle challenge reached">
          <div className="cc-rays" aria-hidden="true" />
          {party && <Confetti />}
          <div className={'cc-coin' + (party ? ' spin' : '')}><div><span>CIRCLE</span><b>{ch.goal}</b><small>TOGETHER</small></div></div>
          <h2 className="cc-wt">YOUR CIRCLE DID IT</h2>
          <p>{ch.goal} meetings between you{spare > 0 ? `, with ${spare} ${spare === 1 ? 'day' : 'days'} to spare` : ''}. A <b>circle coin</b> went to every one of you.</p>
          <button type="button" className="cc-go" onClick={talk}>Say something to the circle</button>
          <button type="button" className="cc-ghost" onClick={() => setForm(true)}>Start another challenge</button>
        </section>
        {coinCase}
      </>
    );
  }

  /* ---------- ENDED (no fail, just the number) ---------- */
  if (ch.status === 'ended') {
    return (
      <>
        <section className="cc-wrap" aria-label="Circle challenge">
          <div className="cc-ph"><span className="cc-tag">CIRCLE CHALLENGE</span><span className="cc-when">ended {short(day(ch.ends_on))}</span></div>
          <h2 className="cc-big">{ch.total} {ch.total === 1 ? 'meeting' : 'meetings'} together</h2>
          <p className="cc-p">That’s how many meetings your circle went to between {short(day(ch.started_on))} and {short(day(ch.ends_on))}. Every one of them counts.</p>
          <button type="button" className="cc-go" onClick={() => setForm(true)}>Start another challenge</button>
        </section>
        {coinCase}
      </>
    );
  }

  /* ---------- ACTIVE ---------- */
  const left = Math.max(1, daysBetween(ch.today, ch.ends_on) + 1);
  return (
    <>
      <section className="cc-pass" aria-label="Circle challenge">
        <div className="cc-ph"><span className="cc-tag">CIRCLE CHALLENGE</span><span className="cc-live"><span className="cc-dot" />ENDS {short(day(ch.ends_on)).toUpperCase()}</span></div>
        <h2 className="cc-goal">{ch.goal} meetings between us</h2>
        <Ring total={ch.total} goal={ch.goal} />
        <div className="cc-stats">
          <div><b>{Math.max(0, ch.goal - ch.total)}</b><span>to go</span></div>
          <div><b>{left}</b><span>{left === 1 ? 'day left' : 'days left'}</span></div>
          <div><b>{ch.this_week}</b><span>this week</span></div>
        </div>
        <div className="cc-lock"><span aria-hidden="true">🔒</span><span>Every check-in counts as one number. Nobody sees who went, or who didn’t. No rankings, ever.</span></div>
        <a className="cc-link" href="/meetings">Went to a meeting? Check in on Meetings →</a>
      </section>
      {coinCase}
    </>
  );
}
