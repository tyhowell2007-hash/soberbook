'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { cleanName, placePath } from '../../lib/rm/words';

const FACT = { phone: 'Phone', website: 'Website', hours: 'Hours', mat_friendly: 'Welcomes people on medication (MAT)',
  takes_children: 'Takes parents with children', lgbtq_affirming: 'LGBTQ+ affirming', court_involved: 'Serves people from court or jail',
  walk_ins: 'Walk-ins', medicaid: 'Medicaid', languages: 'Languages', note: 'Note to the team (not published)' };
const RESULT = { works: 'Works', wrong: 'Wrong number', disconnected: 'Disconnected', no_answer: 'No answer' };

export default function Team() {
  const sb = browserClient();
  const [me, setMe] = useState(null);
  const [dash, setDash] = useState(null);
  const [queue, setQueue] = useState([]);
  const [calls, setCalls] = useState([]);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('updates');

  const load = useCallback(async () => {
    const m = await sb.rpc('rm_me');
    if (m.error) { setErr(m.error.message); return; }
    setMe(m.data);
    if (!m.data?.review) return;
    const [d, q, c] = await Promise.all([sb.rpc('rm_dashboard'), sb.rpc('rm_updates_queue'), sb.rpc('rm_phone_list', { p_state: 'OH', p_limit: 25 })]);
    setDash(d.data); setQueue(q.data || []); setCalls(c.data || []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    let note = null;
    if (decision === 'verify') note = window.__rmNote?.[id] || null;
    const { error } = await sb.rpc('rm_decide_update', { p_id: id, p_decision: decision, p_note: note });
    if (error) setErr(error.message); else load();
  };
  const check = async (id, result) => {
    const { error } = await sb.rpc('rm_check_phone', { p_center: id, p_result: result });
    if (error) setErr(error.message); else load();
  };

  if (err) return <div className="page"><p className="empty">{err}</p></div>;
  if (!me) return <div className="page"><p className="small">Loading…</p></div>;
  if (!me.review) return <div className="page"><div className="empty"><h1>Team only</h1><p className="small">This screen is for the RecoveryMap team.</p></div></div>;

  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="eyebrow">RecoveryMap · private</div>
        <h1>Team dashboard</h1>
        <p className="lede">{me.doctor ? 'Signed in as Dr. Labor: you can approve updates and add your gold badge.' : 'You can approve updates. Only Dr. Labor can add her gold badge.'}</p>
      </div>

      {dash && (
        <div className="grid3">
          <div className="card"><h3>Call taps, last 7 days</h3><b style={{ fontFamily: 'var(--display)', fontSize: 40 }}>{dash.taps_7d}</b>
            <p className="small">Times someone tapped a phone number. Counted by town, never by person.</p>
            {(dash.top_towns || []).map((t) => <p key={t.town + t.state} className="small">{t.town}, {t.state}: <b>{t.n}</b></p>)}</div>
          <div className="card"><h3>Phone re-checks (Ohio)</h3>
            <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${dash.oh_total ? (100 * dash.oh_checked) / dash.oh_total : 0}%`, background: 'var(--teal)' }} /></div>
            <p className="small"><b>{dash.oh_checked}</b> of {dash.oh_total} Ohio listings checked</p></div>
          <div className="card"><h3>Waiting on you</h3>
            <p><b>{dash.updates_pending}</b> program updates</p>
            <p><b>{dash.bad_numbers_open}</b> “number didn’t work” reports · <a href="/admin/listings">open in Listings</a></p>
            <p className="small">{dash.badges} gold badges · {dash.picks} picks · {dash.listings} listings, copied {dash.snapshot}</p></div>
        </div>
      )}

      <div className="seg" role="tablist">
        {[['updates', 'Program updates'], ['calls', 'Phone re-checks'], ...(me.doctor ? [['badge', 'My badge']] : []), ['launch', 'Before launch']].map(([k, l]) =>
          <button key={k} type="button" role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'updates' && (
        <div className="list">
          {queue.length === 0 && <p className="empty">No updates yet. They arrive from “Work here? Send an update” on any listing.</p>}
          {queue.map((u) => (
            <div key={u.id} className="card" style={{ opacity: u.status === 'pending' ? 1 : 0.65 }}>
              <div className="bar"><div><h3><a href={'/rm' + placePath(u)} target="_blank" rel="noreferrer">{cleanName(u.name).name}</a></h3><p className="small">{u.city}, {u.state} · listed phone {u.phone} · sent {new Date(u.created_at).toLocaleDateString()}{u.sender_role ? ` · from: ${u.sender_role}` : ''}</p></div>
                <span className="pill p-both">{u.status}</span></div>
              <dl>{Object.entries(u.facts || {}).map(([k, v]) => <div className="row" key={k}><dt>{FACT[k] || k}</dt><dd>{String(v)}</dd></div>)}</dl>
              {u.status === 'pending' && (
                <div className="actions">
                  <button className="btn ok sm" type="button" onClick={() => decide(u.id, 'approve')}>Approve (live as provider-reported)</button>
                  {me.doctor && <><input aria-label="Your note" placeholder="Your note (optional)" maxLength={400} onChange={(e) => { window.__rmNote = { ...(window.__rmNote || {}), [u.id]: e.target.value }; }} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--line)', flex: '1 1 220px' }} />
                    <button className="btn gold sm" type="button" onClick={() => decide(u.id, 'verify')}>Check &amp; add my badge</button></>}
                  <button className="btn no sm" type="button" onClick={() => decide(u.id, 'decline')}>Turn down</button>
                </div>
              )}
            </div>
          ))}
          <p className="small">Rules built in: only what the program reports; “program for women” is never turned into “takes children”; no success rates or outcome claims (there is no box for them); the sender’s name and email are never shown here or on the site.</p>
        </div>
      )}

      {tab === 'calls' && (
        <div className="list">
          <p className="small">Next Ohio listings to call, never-checked first. Call the number, then mark what happened.</p>
          {calls.map((c) => (
            <div className="item" key={c.id}><div><b>{cleanName(c.name).name}</b><p>{c.city} · {c.admissions_phone || c.phone}{c.last_result ? ` · last: ${RESULT[c.last_result]} ${c.checked_on}` : ''}</p></div>
              <div className="actions">{Object.entries(RESULT).map(([k, l]) => <button key={k} className={`btn sm ${k === 'works' ? 'ok' : 'ghost'}`} type="button" onClick={() => check(c.id, k)}>{l}</button>)}</div></div>
          ))}
        </div>
      )}

      {tab === 'badge' && me.doctor && <BadgeTool sb={sb} onDone={load} />}

      {tab === 'launch' && (
        <div className="card"><h3>Before myrecoverymap.org switches over</h3><ul className="ask">
          <li>Dr. Labor approves her bio, the plain-English explanations, the Narcan steps, “Start here for…”, Ask the Doc and the guide (then flip CONTENT_APPROVED in lib/rm/words.js).</li>
          <li>Attorney reviews the privacy page, terms, “no referral fees” wording and the gold badge.</li>
          <li>A native Spanish speaker reads the Spanish once.</li>
          <li>Add myrecoverymap.org and www to the Sober Book project in Vercel, then point the domain’s DNS there.</li>
          <li>Check the live site, then Dr. Labor shuts down her Replit. She keeps the domain.</li>
        </ul></div>
      )}
    </div>
  );
}

/* Dr. Labor: find any listing and add or remove her badge, note and pick. */
function BadgeTool({ sb, onDone }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const find = async (e) => {
    e.preventDefault();
    const { data, error } = await sb.rpc('search_centers', { p_q: q, p_limit: 20 });
    if (error) setMsg(error.message); else { setRows(data || []); setMsg(data?.length ? '' : 'Nothing found. Try the town or part of the name.'); }
  };
  const set = async (id, note, pick) => {
    const { error } = await sb.rpc('rm_set_badge', { p_center: id, p_note: note, p_pick: pick });
    setMsg(error ? error.message : 'Saved. Your badge is live on that listing.'); onDone();
  };
  const clear = async (id) => {
    const { error } = await sb.rpc('rm_clear_badge', { p_center: id });
    setMsg(error ? error.message : 'Removed.'); onDone();
  };
  return (
    <div className="card" style={{ gap: 14 }}>
      <h3>Add your gold badge to a listing</h3>
      <form className="search" onSubmit={find}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Program name or town" aria-label="Program name or town" /><button className="btn" type="submit">Find</button></form>
      {msg && <p role="status" className="small">{msg}</p>}
      {rows.map((r) => <BadgeRow key={r.id} r={r} onSet={set} onClear={clear} />)}
    </div>
  );
}
function BadgeRow({ r, onSet, onClear }) {
  const [note, setNote] = useState('');
  const [pick, setPick] = useState(false);
  return (
    <div className="item" style={{ alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 6 }}><b>{cleanName(r.name).name}</b><p>{r.city}, {r.state} · {r.phone}</p>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="Your note: what this place does well, what to ask for" style={{ padding: 8, borderRadius: 10, border: '1px solid var(--line)' }} />
        <label className="small"><input type="checkbox" checked={pick} onChange={(e) => setPick(e.target.checked)} /> Show on the home page as one of my picks</label></div>
      <div className="actions"><button className="btn gold sm" type="button" onClick={() => onSet(r.id, note, pick)}>Add my badge</button><button className="btn ghost sm" type="button" onClick={() => onClear(r.id)}>Remove</button></div>
    </div>
  );
}
