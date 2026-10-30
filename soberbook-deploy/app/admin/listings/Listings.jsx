'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';
import { REPORT_REASONS, phoneText, checkedText } from '../../../lib/centers';

/* The list itself. Reuses the moderation queue's mq- styles from
   admin.css so this back room looks like the other one. */
const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));

function ago(ts) {
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function Listings({ initial, failed }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [err, setErr]   = useState(failed ? 'The list didn’t load. Refresh to try again.' : '');

  async function resolve(id, status) {
    setBusy(id); setErr('');
    const { error } = await browserClient().rpc('resolve_listing_report', { p_id: id, p_status: status });
    setBusy(null);
    if (error) { setErr('That didn’t save. Try again.'); return; }
    const today = new Date().toLocaleDateString('en-CA');   // YYYY-MM-DD, local
    setRows((rs) => {
      const center = rs.find((x) => x.id === id)?.center_id;
      return rs.map((r) => ({
        ...r,
        ...(r.id === id ? { status } : null),
        ...(status === 'fixed' && r.center_id === center ? { checked_on: today } : null),
      }));
    });
  }

  const open = rows.filter((r) => r.status === 'open');
  const done = rows.filter((r) => r.status !== 'open');

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/admin" className="rt melink">the queue ›</Link>
      </div>
      <div className="bar">Find Care listing reports</div>
      <div className="pad">
        {err && <p className="mq-gone" role="alert">{err}</p>}

        {open.length === 0 && !err && (
          <div className="mq-empty">
            <h2>Nothing to fix</h2>
            <p>When a member taps “Update this listing” on Find Care, it shows up here.</p>
          </div>
        )}

        {open.map((r) => (
          <div key={r.id} className="mq">
            <div className="mq-top">
              <span className="mq-kind">{REASON[r.reason] || r.reason}</span>
              <span className="mq-when">{ago(r.created_at)}</span>
            </div>
            <div className="mq-who"><b>{r.name}</b> · {r.city}, {r.state}</div>
            {r.phone && <p className="mq-gone">Listed phone: {phoneText(r.phone)}</p>}
            {r.note && <p className="mq-body">{r.note}</p>}
            <p className="mq-reason">Last checked {checkedText(r.checked_on) || 'never'}</p>
            <div className="mq-acts">
              <button type="button" className="btn" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'fixed')}>Fixed (mark checked today)</button>
              <button type="button" className="btn" disabled={busy === r.id}
                      onClick={() => resolve(r.id, 'dismissed')}>Dismiss</button>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <h3 style={{ margin: '22px 0 8px', fontSize: 14 }}>Done</h3>
            {done.map((r) => (
              <div key={r.id} className="mq mq-done">
                <div className="mq-top">
                  <span className="mq-kind">{r.status === 'fixed' ? 'Fixed' : 'Dismissed'}</span>
                  <span className="mq-when">{ago(r.created_at)}</span>
                </div>
                <div className="mq-who"><b>{r.name}</b> · {REASON[r.reason] || r.reason}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
