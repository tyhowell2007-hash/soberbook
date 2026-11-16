'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';
import Wordmark from '../../components/Wordmark';

/* The /admin/beta board. Counts only — never names (Kenny's rule). */
const GOAL = 40;

export default function Board() {
  const [rep, setRep] = useState(null);
  const [handle, setHandle] = useState('');
  const [wave, setWave] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const { data, error } = await browserClient().rpc('admin_beta_report', { p_days: 7 });
    if (error) { setErr('Couldn’t load the report.'); return; }
    setRep(data);
  }
  useEffect(() => { load(); }, []);

  async function act(kind) {
    const h = handle.trim().replace(/^@/, '');
    if (!h) { setErr('Type an @handle first.'); return; }
    setBusy(true); setErr(''); setNote('');
    const sb = browserClient();
    const { error } = kind === 'member'
      ? await sb.rpc('admin_invite_member', { p_handle: h, p_wave: wave })
      : kind === 'newcomer'
        ? await sb.rpc('admin_set_beta_tester', { p_handle: h, p_on: true, p_wave: wave, p_track: 'newcomer' })
        : await sb.rpc('admin_set_beta_tester', { p_handle: h, p_on: false, p_wave: null, p_track: 'newcomer' });
    setBusy(false);
    if (error) { setErr(error.message || 'That didn’t work.'); return; }
    setNote(kind === 'member' ? `Invited @${h}. The card is on their wall now.`
      : kind === 'newcomer' ? `@${h} is in the beta as a newcomer.` : `@${h} is out of the beta.`);
    setHandle(''); load();
  }

  const t = rep?.testers || {};
  const inBeta = (t.current || 0) + (t.newcomer || 0);
  const missions = rep?.missions || [];
  const done = missions.reduce((n, m) => n + (m.done || 0), 0);
  const skipped = missions.reduce((n, m) => n + (m.skipped || 0), 0);
  const mood = rep?.mood_open_vs_close || {};
  const ev = rep?.events_by_name || {};

  return (
    <>
      <div className="mast">
        <Wordmark />
        <Link href="/admin" className="rt">safety reports ›</Link>
      </div>
      <div className="bar">Beta testers · Kenny&rsquo;s plan</div>
      <div className="pad">
        <div className="bl-card">
          <h3>Who&rsquo;s in</h3>
          <div className="bl-stats">
            <div><b>{t.current ?? '–'}</b><span>members in</span></div>
            <div><b>{t.newcomer ?? '–'}</b><span>newcomers</span></div>
            <div><b>{t.invited_pending ?? '–'}</b><span>waiting</span></div>
            <div><b>{t.declined ?? '–'}</b><span>said no</span></div>
          </div>
          <p className="bl-small" style={{ margin: '10px 0 0' }}>{inBeta + (t.invited_pending || 0)} of {GOAL} spots used (in + waiting)</p>
        </div>

        <div className="bl-card">
          <h3>Invite someone</h3>
          <input className="bl-in" value={handle} onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <div className="bl-btns" style={{ marginTop: 10 }}>
            <button type="button" className="bl-go" disabled={busy} onClick={() => act('member')}>Invite (member)</button>
            <button type="button" className="bl-no" disabled={busy} onClick={() => act('newcomer')}>Add newcomer</button>
          </div>
          <p className="bl-small" style={{ margin: '10px 0 0' }}>
            Wave{' '}
            {[1, 2].map((w) => (
              <button key={w} type="button" className="bl-chip" aria-pressed={wave === w} onClick={() => setWave(w)}
                style={{ padding: '3px 10px', marginRight: 4 }}>{w}</button>
            ))}
            · <button type="button" onClick={() => act('remove')} disabled={busy}
                style={{ border: 0, background: 'none', color: '#9A1B1B', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
                Take this @handle out of the beta</button>
          </p>
          <p className="bl-small" style={{ margin: '6px 0 0' }}>
            Members: the invite card shows on their wall; &ldquo;No thanks&rdquo; is final. Newcomers: add them after they&rsquo;ve signed up from your personal invite.
          </p>
          {note && <p className="bl-ok" style={{ margin: '10px 0 0' }}>{note}</p>}
          {err && <p className="bl-err">{err}</p>}
        </div>

        <div className="bl-card">
          <h3>Last 7 days</h3>
          <div className="bl-kv"><span>Missions done</span><b>{done}</b></div>
          <div className="bl-kv"><span>Missions skipped</span><b>{skipped}</b></div>
          <div className="bl-kv"><span>Mood on open → close</span><b>{mood.n >= 5 ? `${mood.open ?? '–'} → ${mood.close ?? '–'}` : 'needs 5+ testers'}</b></div>
          <div className="bl-kv"><span>App opens</span><b>{ev['app.open'] || 0}</b></div>
          <div className="bl-kv"><span>Problem reports opened from Beta Lab</span><b>{ev['beta.report_open'] || 0}</b></div>
          <p className="bl-small" style={{ margin: '10px 0 0' }}>Counts only. Never names. Groups under 5 testers stay hidden.</p>
        </div>
      </div>
    </>
  );
}
