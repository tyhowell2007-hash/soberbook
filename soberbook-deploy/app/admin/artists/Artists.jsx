'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* The owner's queue. Approve / Not yet on applications (Not yet lets them
   apply again in 60 days), Remove on verified artists. No fixed follower
   number — Ty's call on each one. */
export default function Artists({ initial }) {
  const supabase = browserClient();
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function act(handle, action) {
    if (action === 'revoke' && !window.confirm(`Remove @${handle}'s checkmark and artist page?`)) return;
    setBusy(handle + action); setErr('');
    const { data, error } = await supabase.rpc('artist_decide', { p_handle: handle, p_action: action });
    if (error) setErr(error.message); else setQ(data);
    setBusy('');
  }

  const pending = q?.pending || [];
  const approved = q?.approved || [];
  return (
    <>
      {err && <p className="art-err" role="alert">{err}</p>}
      <h2 className="sec">Waiting · {pending.length}</h2>
      {pending.length === 0 && <p className="hint">No applications waiting.</p>}
      {pending.map((a) => (
        <div className="art-q" key={a.handle}>
          <div className="art-head">
            <span className="art-name">{a.name}</span>
            <Link href={`/u/${a.handle}`} className="art-genre">@{a.handle}</Link>
            {a.genre && <span className="art-genre">· {a.genre}</span>}
          </div>
          <table>
            <tbody>
              {(a.links || []).map((l) => (
                <tr key={l.url}><td>{l.label}</td><td><a href={l.url} target="_blank" rel="noreferrer noopener">{l.url}</a></td></tr>
              ))}
              <tr><td>Following</td><td>{a.claims || '—'}</td></tr>
              <tr><td>Proof</td><td>{a.proof || '—'}</td></tr>
              <tr><td>Applied</td><td>{new Date(a.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td></tr>
            </tbody>
          </table>
          <div className="art-acts">
            <button type="button" className="art-btn small" disabled={!!busy} onClick={() => act(a.handle, 'approve')}>Approve</button>
            <button type="button" className="art-btn ghost small" disabled={!!busy} onClick={() => act(a.handle, 'decline')}>Not yet</button>
          </div>
        </div>
      ))}

      <h2 className="sec">Verified artists · {approved.length}</h2>
      {approved.map((a) => (
        <div className="art-q" key={a.handle}>
          <div className="art-row" style={{ justifyContent: 'space-between' }}>
            <span>
              <span className="art-name">{a.name}</span>{' '}
              <Link href={`/u/${a.handle}`} className="art-genre">@{a.handle}</Link>
              <span className="art-count"> · {Number(a.followers || 0).toLocaleString()} followers</span>
            </span>
            <button type="button" className="art-btn ghost small" disabled={!!busy} onClick={() => act(a.handle, 'revoke')}>Remove</button>
          </div>
        </div>
      ))}
    </>
  );
}
