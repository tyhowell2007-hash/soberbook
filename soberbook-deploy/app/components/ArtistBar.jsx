'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* The followers count + Follow button on an artist's page, with whatever
   the server page passes as children (the Message button) beside it.
   🔴 A COUNT, NEVER A LIST — see ArtistPanel / 0178. */
export default function ArtistBar({ handle, followers, following, isMine, days, sinceYear, children }) {
  const [n, setN] = useState(Number(followers) || 0);
  const [on, setOn] = useState(!!following);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function toggle() {
    setBusy(true); setErr('');
    const { data, error } = await browserClient().rpc('artist_follow', { p_handle: handle, p_on: !on });
    if (error) setErr(error.message);
    else { setOn(!!data.following); setN(Number(data.followers) || 0); }
    setBusy(false);
  }

  return (
    <>
      <div className="art-stats">
        <span><b>{n.toLocaleString()}</b> {n === 1 ? 'follower' : 'followers'}{n === 0 ? ' yet' : ''}</span>
        {/* Only when the view hands back a count — can_see_day_count() has
            already applied the artist's own day-count setting. */}
        {/* 0181: an author/podcaster who gives a year shows "Since 2005 in
            recovery" (the approved Dr. Labor prototype) instead of a day count. */}
        {sinceYear
          ? <span><b>Since {sinceYear}</b> in recovery</span>
          : days != null && <span><b>{Number(days).toLocaleString()}</b> {days === 1 ? 'day' : 'days'} sober</span>}
      </div>
      <div className="art-btns">
        {isMine
          ? <Link href="/artist" className="art-follow" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Edit artist page</Link>
          : (
            <button type="button" className="art-follow" onClick={toggle} disabled={busy} aria-pressed={on}>
              {on ? 'Following ✓' : 'Follow'}
            </button>
          )}
        {children}
      </div>
      {err && <p className="art-err" role="alert">{err}</p>}
    </>
  );
}
