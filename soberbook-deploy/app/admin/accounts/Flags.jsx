'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../../lib/supabase-browser';
import Wordmark from '../../components/Wordmark';

const KIND = {
  returning: { text: 'Possible returning', cls: 'tk-same' },
  bot: { text: 'Possible bot', cls: 'tk-same' },
  spam: { text: 'Possible spam', cls: 'tk-st tk-st-prog' },
  throwaway: { text: 'Throwaway email', cls: 'tk-st tk-st-new' },
  ghost: { text: 'Ghost profile', cls: 'tk-st tk-st-new' },
};
const TABS = [
  { id: 'open', label: 'Needs a look', match: (f) => f.status === 'open' },
  { id: 'watch', label: 'Watching', match: (f) => f.status === 'watch' },
  { id: 'done', label: 'Done', match: (f) => f.status === 'cleared' || f.status === 'suspended' },
];
const DONE = { clear: 'Cleared. Nothing happens to them.', watch: 'Watching. A new flag on them still reaches you.', suspend: 'Suspended. If they come back on a new account, you’ll get a push.' };

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Flags({ flags }) {
  const router = useRouter();
  const [tab, setTab] = useState('open');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  async function act(id, action) {
    setBusy(id); setErr(''); setNote('');
    const { error } = await browserClient().rpc('account_flag_act', { p_id: id, p_action: action });
    setBusy(null);
    if (error) { setErr('Couldn’t do that. Try again.'); return; }
    setNote(DONE[action]);
    router.refresh();
  }

  const count = (m) => flags.filter(m).length;
  const shown = flags.filter(TABS.find((t) => t.id === tab).match);

  return (
    <>
      <div className="mast">
        <Wordmark />
        <Link href="/admin" className="rt melink">safety reports ›</Link>
      </div>
      <div className="bar">Accounts · {count((f) => f.status === 'open')} need a look</div>
      <div className="pad">
        <div className="tk-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={'tk-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
              {t.label} {count(t.match)}
            </button>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
        {note && <p className="tk-ok">✓ {note}</p>}
        {shown.length === 0 && (
          <div className="tk-empty"><h2>Nothing here.</h2>
            <p>{tab === 'open' ? 'No new accounts look off right now. You’ll get a push when one does.' : 'Nothing in this column.'}</p></div>
        )}
        {shown.map((f) => {
          const k = KIND[f.kind] || KIND.ghost;
          return (
            <article key={f.id} className="tk-card">
              <div className="tk-row"><b>@{f.handle}</b><span className={k.cls}>{k.text}</span></div>
              <small className="tk-when">Flagged {ago(f.created_at)}{f.joined ? ` · joined ${ago(f.joined)}` : ''}{f.suspended ? ' · suspended' : ''}</small>
              <dl className="tk-meta">
                <dt>Why</dt><dd>{f.detail}</dd>
                <dt>So far</dt><dd>{f.requests} friend requests, {f.chats} new chats, {f.posts} posts</dd>
              </dl>
              {(f.status === 'open' || f.status === 'watch') && (
                <div className="tk-acts">
                  <button type="button" className="btn ghost" disabled={busy === f.id} onClick={() => act(f.id, 'clear')}>Looks fine</button>
                  {f.status === 'open' && <button type="button" className="btn ghost" disabled={busy === f.id} onClick={() => act(f.id, 'watch')}>Keep an eye</button>}
                  <button type="button" className="btn" disabled={busy === f.id} onClick={() => act(f.id, 'suspend')}>Suspend</button>
                </div>
              )}
              <p style={{ margin: '8px 0 0' }}><Link href={`/u/${f.handle}`} className="melink">Open their profile ›</Link></p>
            </article>
          );
        })}
      </div>
    </>
  );
}
