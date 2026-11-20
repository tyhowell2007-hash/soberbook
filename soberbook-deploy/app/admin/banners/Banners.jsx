'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../../lib/supabase-browser';
import './banners-admin.css';

/* =====================================================================
   The banner test screen (0208). Three parts:
   1. Numbers by week, banner and page, with the plan's rates:
      click = taps / views, hide = hides / views, report = reports / views,
      answer = answers / views (question banner only).
   2. The answers — no names exist to show. Mark each OK or Hidden;
      "OK + can share" is what may go into Recovery Belongs materials.
   3. The switches: on/off, and the partner's line, link and logo.
   🔴 STOP RULES (the plan's, binding): pause a banner if hides or reports
   jump, if people say it felt unwelcome or triggering, or if it gets in
   the way of posting or messaging. The switch below is the pause.
   ===================================================================== */

const pct = (a, b) => (b > 0 ? (Math.round((a / b) * 1000) / 10) + '%' : '–');
const TAG = { abstinence: 'Abstinence', harm_reduction: 'Harm reduction', medication: 'Medication-assisted', family_ally: 'Family or ally', other: 'Other' };
const NAME = { rb_prompt: 'Question', helios: 'Helios' };

export default function Banners() {
  const [stats, setStats] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [banners, setBanners] = useState(null);
  const [err, setErr] = useState('');
  const [said, setSaid] = useState('');

  async function load() {
    const sb = browserClient();
    const [s, a, b] = await Promise.all([
      sb.rpc('banner_stats_admin'), sb.rpc('banner_answers_admin'), sb.rpc('banners_admin'),
    ]);
    const e = s.error || a.error || b.error;
    if (e) { setErr('Couldn’t load: ' + e.message + ' (has the 0208 SQL been run?)'); return; }
    setStats(s.data || []); setAnswers(a.data || []); setBanners(b.data || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    const { error } = await browserClient().rpc('banner_answer_set', { p_id: id, p_status: status });
    if (error) { setErr(error.message); return; }
    setAnswers((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function save(b, patch) {
    const n = { ...b, ...patch };
    const { error } = await browserClient().rpc('banner_update', {
      p_id: n.id, p_active: n.active, p_body: n.body || '', p_link: n.link_url || '', p_logo: n.logo_url || '',
    });
    if (error) { setErr('Not saved: ' + error.message); return; }
    setErr(''); setSaid('Saved.');
    setTimeout(() => setSaid(''), 2500);
    load();
  }

  if (err && !stats) return <p className="ba-err">{err}</p>;
  if (!stats) return <p className="ba-dim">Loading…</p>;

  return (
    <div className="ba">
      {err && <p className="ba-err">{err}</p>}
      {said && <p className="ba-ok">{said}</p>}

      <h2 className="ba-h">Numbers by week</h2>
      <p className="ba-dim">Totals only, no names. Meetings is the control page and never shows a banner.</p>
      {stats.length === 0 ? <p className="ba-dim">Nothing yet.</p> : (
        <div className="ba-scroll">
          <table className="ba-t">
            <thead><tr><th>Week of</th><th>Banner</th><th>Page</th><th>Views</th><th>Click</th><th>Hide</th><th>Report</th><th>Answer</th></tr></thead>
            <tbody>
              {stats.map((r) => {
                return (
                  <tr key={r.week + r.banner_id + r.page}>
                    <td>{r.week}</td><td>{NAME[r.banner_id] || r.banner_id}</td><td>{r.page}</td>
                    <td>{r.views}</td><td>{pct(r.taps, r.views)}</td><td>{pct(r.hides, r.views)}</td>
                    <td>{pct(r.reports, r.views)}</td><td>{r.banner_id === 'rb_prompt' ? pct(r.answers, r.views) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="ba-dim">Jesse&apos;s plan sets the pause limits once the first weeks show what normal looks like. Until then, watch the Hide and Report columns week to week.</p>

      <h2 className="ba-h">Answers ({answers.length})</h2>
      <p className="ba-dim">No names are stored, so none can show. Only mark &ldquo;OK&rdquo; what&apos;s fine to quote, and only quote the ones that say &ldquo;can share&rdquo;.</p>
      {answers.length === 0 ? <p className="ba-dim">No answers yet.</p> : (
        <ul className="ba-list">
          {answers.map((a) => (
            <li key={a.id} className={'ba-a ba-' + a.status}>
              <div className="ba-meta">
                {a.on_day} · {a.page || 'home'}{a.tag ? ' · ' + TAG[a.tag] : ''} · {a.share_ok ? <b>can share</b> : 'don’t share'} · {a.status}
              </div>
              {a.answer && <p className="ba-txt">{a.answer}</p>}
              <div className="ba-acts">
                <button type="button" onClick={() => setStatus(a.id, 'ok')} disabled={a.status === 'ok'}>OK</button>
                <button type="button" onClick={() => setStatus(a.id, 'hidden')} disabled={a.status === 'hidden'}>Hide</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="ba-h">Switches</h2>
      {banners.map((b) => <BannerRow key={b.id} b={b} onSave={save} />)}
    </div>
  );
}

function BannerRow({ b, onSave }) {
  const [body, setBody] = useState(b.body || '');
  const [link, setLink] = useState(b.link_url || '');
  const [logo, setLogo] = useState(b.logo_url || '');
  const partner = b.kind === 'partner';
  return (
    <div className="ba-card">
      <div className="ba-row">
        <b>{NAME[b.id] || b.id}</b>
        <span className="ba-dim">{b.title} · shows on {b.pages.join(', ')}</span>
      </div>
      <p className="ba-state">{b.active ? (partner && !b.link_url ? 'On, but hidden until it has a link' : 'On') : 'Off'}</p>
      <label className="ba-l">Line under the title<input value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} /></label>
      {partner && (
        <>
          <label className="ba-l">Resource link (https://…)<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
          <label className="ba-l">Logo image link (optional)<input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://" /></label>
        </>
      )}
      <div className="ba-acts">
        <button type="button" onClick={() => onSave(b, { body, link_url: link, logo_url: logo })}>Save</button>
        <button type="button" className={b.active ? 'ba-off' : 'ba-on'} onClick={() => onSave(b, { body, link_url: link, logo_url: logo, active: !b.active })}>
          {b.active ? 'Turn off (pause)' : 'Turn on'}
        </button>
      </div>
    </div>
  );
}
