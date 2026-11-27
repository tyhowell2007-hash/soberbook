'use client';
import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import { track } from '../../lib/track';

/* The private rooms and a one-tap Join / Leave. Joining takes you
   straight into the room (the Rooms tab, on that room's tab). */
export default function SpacesList({ initial }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  async function act(slug, join) {
    setBusy(slug); setErr('');
    const { error } = await browserClient().rpc(join ? 'join_space' : 'leave_space', { p_slug: slug });
    setBusy(null);
    if (error) { setErr('That didn’t go through. Try again in a moment.'); return; }
    setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, joined: join } : r)));
    track(join ? 'spaces.join' : 'spaces.leave', { space: slug });
    if (join) window.location.href = '/friends?room=' + encodeURIComponent(slug);
  }

  if (!rows.length) {
    return <p className="sp-empty">The private spaces are closed just now. Try again in a bit.</p>;
  }

  return (
    <>
      <p className="sp-intro">
        Rooms for people who share something. You’re anonymous in here, and
        what’s said stays in the room. Report anything that isn’t right and
        the team will look at it.
      </p>
      <ul className="sp-list">
        {rows.map((r) => (
          <li key={r.slug} className="sp-card">
            <div className="sp-top">
              <span className="sp-emoji" aria-hidden="true">{r.emoji}</span>
              <div>
                <h2 className="sp-name">{r.name}</h2>
                <p className="sp-blurb">{r.blurb}</p>
              </div>
            </div>
            {r.joined ? (
              <div className="sp-acts">
                <Link href={'/friends?room=' + encodeURIComponent(r.slug)} className="sp-go">Open the room →</Link>
                <button type="button" className="sp-leave" disabled={busy === r.slug}
                        onClick={() => act(r.slug, false)}>Leave</button>
              </div>
            ) : (
              <div className="sp-acts">
                <button type="button" className="sp-go" disabled={busy === r.slug}
                        onClick={() => act(r.slug, true)}>
                  {busy === r.slug ? 'Joining…' : 'Join'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="sp-err" role="alert">{err}</p>}
    </>
  );
}
