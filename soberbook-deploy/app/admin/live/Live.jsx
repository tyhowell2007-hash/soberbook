'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../../lib/supabase-browser';
import Wordmark from '../../components/Wordmark';

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${Math.max(m, 1)} min ago` : `${Math.floor(m / 60)}h ago`;
}

export default function Live({ list }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(null);

  async function end(x) {
    setBusy(x.id); setErr('');
    const { error } = x.type === 'talk'
      ? await browserClient().rpc('talk_end', { p_talk: x.id })
      : await browserClient().rpc('admin_close_meeting_room', { p_room: x.id });
    setBusy(null); setSure(null);
    if (error) { setErr('Couldn’t end that. Try again.'); return; }
    router.refresh();
  }

  return (
    <>
      <div className="mast">
        <Wordmark />
        <Link href="/admin" className="rt melink">safety reports ›</Link>
      </div>
      <div className="bar">Live now · {list.length} room{list.length === 1 ? '' : 's'}</div>
      <div className="pad">
        {err && <div className="err">{err}</div>}
        {list.length === 0 && <div className="tk-empty"><h2>Nothing live.</h2><p>No talks or meeting rooms are open right now.</p></div>}
        {list.map((x) => (
          <article key={x.id} className="tk-card">
            <div className="tk-row"><b>🔴 {x.title}</b>{x.type === 'talk' && <span className="tk-st tk-st-new">{x.people} in it</span>}</div>
            <small className="tk-when">Host @{x.host || 'unknown'} · started {ago(x.since)}{x.locked ? ' · 🔒 locked' : ''}</small>
            {sure === x.id ? (
              <div className="tk-acts">
                <span className="tk-ok" style={{ color: '#9A3412' }}>End it for everyone?</span>
                <button type="button" className="btn" disabled={busy === x.id} onClick={() => end(x)}>Yes, end it</button>
                <button type="button" className="btn ghost" onClick={() => setSure(null)}>Cancel</button>
              </div>
            ) : (
              <div className="tk-acts">
                <Link href={x.href} className="btn ghost">Drop in</Link>
                <button type="button" className="btn" onClick={() => setSure(x.id)}>End</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
