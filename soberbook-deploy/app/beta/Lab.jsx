'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import { isIosApp } from '../../lib/is-ios-app';
import { isPhone } from '../../lib/is-phone';
import { track, setActiveMission, refreshBetaStatus } from '../../lib/track';
import BrandName from '../components/BrandName';

/* =====================================================================
   BETA LAB — Kenny's plan and Kenny's words, 0206, 15 Nov 2026.
   Written by Kenny's Claude, restyled in the app's look by Ty's Claude.
   Order: three quick questions (current members) → the agreement →
   missions, a quick check, the weekly check-in, Report it, and the
   switch to stop sharing usage data. Nothing is counted before "I agree".
   ===================================================================== */
const SKIP_REASONS = [
  ['not_comfortable', 'Not comfortable sharing that'],
  ['no_time', 'Didn’t have time'],
  ['confusing', 'Couldn’t figure it out'],
  ['not_useful', 'Not useful to me'],
];

function ctx() {
  let s = null;
  try { s = sessionStorage.getItem('sb_session'); } catch { /* fine */ }
  return { session: s, v: process.env.NEXT_PUBLIC_APP_VERSION || 'web', ios: isIosApp(), screen: '/beta' };
}

export default function Lab() {
  const [lab, setLab] = useState(undefined);
  const [msg, setMsg] = useState('');
  const [skipIntake, setSkipIntake] = useState(false);
  const [phone, setPhone] = useState(true);

  async function load() {
    const { data } = await browserClient().rpc('my_beta_lab');
    setLab(data ?? null);
  }
  useEffect(() => {
    if (!isPhone()) { setPhone(false); return; }   // phones only (Ty, 15 Nov)
    load().catch(() => setLab(null));
  }, []);

  if (!phone) return (
    <div className="bl-card"><h3>Beta Lab is on your phone</h3>
      <p style={{ margin: 0 }}>Open the app on your phone to see your missions and check-ins.</p></div>
  );

  if (lab === undefined) return <p className="bl-small" style={{ padding: 12 }}>One second…</p>;
  if (lab === null) return (
    <div className="bl-card"><h3>This page isn&rsquo;t available.</h3>
      <p style={{ margin: 0 }}>Beta Lab is only open to members taking part in the beta.</p></div>
  );

  if (!lab.agreed_at) {
    const intake = lab.track === 'current' && (lab.surveys || []).find((s) => s.kind === 'intake');
    if (intake && !lab.intake_done && !skipIntake) return (
      <>
        <SurveyCard title="Welcome in" lede="Three quick questions first." survey={intake}
          onDone={() => load()} onSkip={() => setSkipIntake(true)} />
      </>
    );
    return <Agreement onDone={() => { refreshBetaStatus(); load(); }} />;
  }

  const pulse = (lab.surveys || []).find((s) => s.kind === 'pulse');
  const weekly = (lab.surveys || []).find((s) => s.kind === 'weekly');
  const weeks = [...new Set((lab.missions || []).map((m) => m.week))];

  async function mission(m, action, extra = {}) {
    await browserClient().rpc('beta_mission_update', {
      p_mission: m.id, p_action: action, p_ease: extra.ease ?? null, p_reason: extra.reason ?? null,
    });
    track('mission.' + action, { mission: m.id });
    setActiveMission(action === 'start' ? m.id : null);
    if (action !== 'start') load();
  }

  return (
    <>
      <div className="bl-card bl-intro">
        <p style={{ margin: 0 }}>Thanks for being one of our first. Every mission is optional; skip anything you&rsquo;re not comfortable with.</p>
      </div>
      {msg && <p className="bl-ok" role="status">{msg}</p>}

      {weeks.map((w) => (
        <section key={w}>
          <h2 className="bl-wk">Week {w}</h2>
          <div className="bl-card">
            {lab.missions.filter((m) => m.week === w).map((m) => (
              <MissionRow key={m.id} m={m} onAction={mission} />
            ))}
          </div>
        </section>
      ))}

      {pulse && <SurveyCard title="Quick check (30 seconds)" survey={pulse} onDone={() => setMsg('Thanks!')} />}
      {weekly && <SurveyCard title="Weekly check-in (2 minutes)" survey={weekly} onDone={() => setMsg('Thanks!')} />}

      <div className="bl-card">
        <h3>Found a problem or have an idea?</h3>
        <Link href="/report" className="bl-link" onClick={() => track('beta.report_open')}>Report it ›</Link>
      </div>

      <div className="bl-card">
        <h3>Your settings</h3>
        <label className="bl-tick">
          <input type="checkbox" checked={!lab.tracking_off}
            onChange={async (e) => {
              await browserClient().rpc('beta_set_tracking', { p_on: e.target.checked });
              refreshBetaStatus(); load();
            }} />
          Share my usage data with the team
        </label>
      </div>
    </>
  );
}

function MissionRow({ m, onAction }) {
  const [rating, setRating] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const cls = 'bl-ms' + (m.done ? ' done' : m.skipped ? ' skip' : '');
  return (
    <div className={cls}>
      <span className="bl-dot" aria-hidden="true">{m.done ? '✓' : m.skipped ? '–' : ''}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="bl-t">{m.title}</div>
        {!m.done && !m.skipped && m.blurb && <div className="bl-b">{m.blurb}</div>}
        {!m.done && !m.skipped && (
          <div className="bl-mini">
            {!rating && !skipping && <>
              {m.link && <Link href={m.link} className="g" onClick={() => onAction(m, 'start')}>Go</Link>}
              <button type="button" onClick={() => setRating(true)}>I did it</button>
              <button type="button" onClick={() => setSkipping(true)}>Skip</button>
            </>}
            {rating && <>
              <span className="bl-small" style={{ alignSelf: 'center' }}>How easy was that?</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => onAction(m, 'done', { ease: n })}>{n}</button>
              ))}
            </>}
            {skipping && <>
              {SKIP_REASONS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => onAction(m, 'skip', { reason: k })}>{label}</button>
              ))}
              <button type="button" onClick={() => onAction(m, 'skip')}>Just skip</button>
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

export function SurveyCard({ title, lede, survey, onDone, onSkip }) {
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (id, v) => setAns((a) => ({ ...a, [id]: { ...a[id], ...v } }));

  async function submit() {
    const p_answers = Object.entries(ans).map(([question_id, v]) => ({ question_id, score: v.score ?? null, text: v.text ?? null }));
    if (!p_answers.length) { setErr('Answer at least one, or skip.'); return; }
    setBusy(true); setErr('');
    const { error } = await browserClient().rpc('submit_beta_survey', { p_survey: survey.id, p_answers, p_ctx: ctx() });
    setBusy(false);
    if (error) { setErr('That didn’t send. Try again in a moment.'); return; }
    track('survey.submit', { kind: survey.kind });
    setAns({}); onDone?.();
  }

  const pick = (q, n, label) => (
    <button key={n} type="button" className="bl-chip" aria-pressed={ans[q.id]?.score === n}
      onClick={() => set(q.id, { score: n })}>{label}</button>
  );

  return (
    <div className="bl-card">
      <h3>{title}</h3>
      {lede && <p>{lede}</p>}
      {(survey.questions || []).map((q) => (
        <div key={q.id}>
          <div className="bl-q">{q.prompt}</div>
          {q.type === 'scale5' && <div className="bl-scale">{[1, 2, 3, 4, 5].map((n) => pick(q, n, n))}</div>}
          {q.type === 'nps' && <div className="bl-scale">{[...Array(11).keys()].map((n) => pick(q, n, n))}</div>}
          {q.type === 'yesno' && <div className="bl-chips">{['No', 'Yes'].map((l, i) => pick(q, i, l))}</div>}
          {q.type === 'choice' && <div className="bl-chips">{(q.options || []).map((o, i) => pick(q, i, o))}</div>}
          {(q.type === 'text' || q.comment) && (
            <textarea className="bl-ta" maxLength={2000} placeholder="Optional"
              value={ans[q.id]?.text || ''} onChange={(e) => set(q.id, { text: e.target.value })} />
          )}
        </div>
      ))}
      {err && <p className="bl-err">{err}</p>}
      <div className="bl-btns" style={{ marginTop: 12 }}>
        <button type="button" className="bl-go" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send'}</button>
        {onSkip && <button type="button" className="bl-no" onClick={onSkip}>Skip</button>}
      </div>
    </div>
  );
}

function Agreement({ onDone }) {
  const [tracking, setTracking] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <div className="bl-card bl-ag">
      <h3>Welcome to the <BrandName /> beta</h3>
      <p><b>It&rsquo;s unfinished.</b> Things may break or change. Please tell us when they do.</p>
      <p><b>Keep it between us.</b> Please don&rsquo;t share screenshots or details of features outside the beta group until we launch.</p>
      <p><b>What we track as a tester.</b> Which screens you open, what you tap, how long you stay, and when the app has problems. Plus your survey answers.</p>
      <p><b>What we never track.</b> The words you write, what you search, your exact location, or your contacts. No outside companies or ad trackers ever see your data.</p>
      <p><b>How we look at it.</b> In groups, as counts and trends. Not to watch any one person.</p>
      <p><b>You&rsquo;re in control.</b> Turn off tracking or leave the beta any time. Beta tracking data is deleted after 12 months.</p>
      <p><b>If you&rsquo;re struggling,</b> call or text 988 any time (US).</p>
      <label className="bl-tick">
        <input type="checkbox" checked={tracking} onChange={(e) => setTracking(e.target.checked)} />
        Share my usage data with the team
      </label>
      <div className="bl-btns">
        <button type="button" className="bl-go" disabled={busy}
          onClick={async () => { setBusy(true); await browserClient().rpc('beta_agree', { p_tracking: tracking }); setBusy(false); onDone(); }}>
          I agree
        </button>
        <Link href="/wall" className="bl-no" style={{ textAlign: 'center', textDecoration: 'none' }}>Not now</Link>
      </div>
    </div>
  );
}
