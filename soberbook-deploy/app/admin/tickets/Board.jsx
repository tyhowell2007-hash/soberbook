'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { catLabel, ticketNo } from '../../../lib/tickets';

/* The board's client half. Every button posts to /api/ticket/act, which
   re-checks that you are Ty or Kenny before doing anything. */
const TABS = [
  { id: 'new', label: 'New', match: (t) => t.status === 'new' },
  { id: 'working', label: 'Working', match: (t) => t.status === 'working' },
  { id: 'done', label: 'Fixed', match: (t) => t.status === 'fixed' || t.status === 'notbug' },
];

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export default function Board({ tickets }) {
  const router = useRouter();
  const [tab, setTab] = useState(tickets.some((t) => t.status === 'new') ? 'new' : 'working');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  async function act(id, action, body) {
    setBusy(id); setErr(''); setNote('');
    try {
      const r = await fetch('/api/ticket/act', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Couldn’t do that.');
      if (action === 'fixed' && j.closed > 1) setNote(`Fixed. ${j.closed} people who reported it were told.`);
      setReplyTo(null); setDraft('');
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(null);
  }

  const count = (m) => tickets.filter(m).length;
  const shown = tickets.filter(TABS.find((x) => x.id === tab).match);

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/admin" className="rt melink">safety reports ›</Link>
      </div>
      <div className="bar">Problem tickets · {count((t) => t.status === 'new')} new</div>
      <div className="pad">
        <div className="tk-tabs">
          {TABS.map((x) => (
            <button key={x.id} type="button" className={'tk-tab' + (tab === x.id ? ' on' : '')}
                    onClick={() => setTab(x.id)}>
              {x.label} {count(x.match)}
            </button>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
        {note && <p className="tk-ok">✓ {note}</p>}
        {shown.length === 0 && (
          <div className="tk-empty"><h2>Nothing here.</h2>
            <p>{tab === 'new' ? 'No new problem tickets. Every one that came in has been picked up.' : 'Nothing in this column right now.'}</p></div>
        )}

        {shown.map((t) => (
          <article key={t.id} className="tk-card">
            <div className="tk-row">
              <b>{ticketNo(t.num)} · {catLabel(t.category)}</b>
              {t.same > 0 && t.status !== 'fixed' && <span className="tk-same">{t.same + 1} people</span>}
            </div>
            <small className="tk-when">
              {t.who}{t.signed_out ? ' (signed out)' : ''} · {ago(t.created_at)}
              {t.owner ? ` · ${t.owner} has it` : ''}
            </small>
            <p className="tk-desc">{t.description}</p>
            <dl className="tk-meta">
              {t.screen && <><dt>Screen</dt><dd>{t.screen}</dd></>}
              {t.device && <><dt>Phone</dt><dd>{t.device}</dd></>}
              {t.error_text && <><dt>Error</dt><dd>{t.error_text}</dd></>}
            </dl>
            {t.shot && <a href={t.shot} target="_blank" rel="noopener noreferrer" className="tk-shotimg"><img src={t.shot} alt={`Screenshot for ${ticketNo(t.num)}`} /></a>}
            {t.replies.map((r, i) => <div key={i} className="tk-reply"><b>{r.who}:</b> {r.body}</div>)}

            {replyTo === t.id ? (
              <div className="tk-replybox">
                <textarea className="tk-ta" rows={3} maxLength={2000} value={draft} autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={t.signed_out ? 'This is emailed to them.' : 'They get an alert and see it in My tickets.'} />
                <div className="tk-acts">
                  <button type="button" className="btn" disabled={busy === t.id || !draft.trim()}
                          onClick={() => act(t.id, 'reply', draft)}>Send reply</button>
                  <button type="button" className="btn ghost" onClick={() => { setReplyTo(null); setDraft(''); }}>Cancel</button>
                </div>
              </div>
            ) : t.status === 'fixed' || t.status === 'notbug' ? (
              <div className="tk-acts">
                <span className="tk-ok">{t.status === 'fixed' ? '✓ Fixed' : 'Closed, not a bug'}</span>
                <button type="button" className="btn ghost" disabled={busy === t.id} onClick={() => act(t.id, 'reopen')}>Reopen</button>
              </div>
            ) : (
              <div className="tk-acts">
                {t.status === 'new' && <button type="button" className="btn" disabled={busy === t.id} onClick={() => act(t.id, 'take')}>I&rsquo;ll take it</button>}
                <button type="button" className="btn ghost" disabled={busy === t.id} onClick={() => { setReplyTo(t.id); setDraft(''); }}>Reply</button>
                <button type="button" className="btn ghost" disabled={busy === t.id} onClick={() => act(t.id, 'fixed')}>Mark fixed</button>
                <button type="button" className="btn ghost" disabled={busy === t.id} onClick={() => act(t.id, 'notbug')}>Not a bug</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
