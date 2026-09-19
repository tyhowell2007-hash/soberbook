'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE ARTIST PANEL on /u/<handle>.  19 Sept 2026.

   Renders nothing at all unless artist_page() says this handle is an
   approved artist the viewer is allowed to see (blocks and suspensions are
   applied inside it, through public_profiles). So on 99% of profiles this
   component is invisible.

   🔴 FOLLOWERS ARE A COUNT, NEVER A LIST. The old Following feature had
   public lists and they were retired (see the note at the bottom of
   u/[handle]/page.jsx): a list of who follows a recovery artist is a list
   of people in recovery. Nothing in the database will return one.
   ===================================================================== */
const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export default function ArtistPanel({ handle }) {
  const supabase = browserClient();
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    supabase.rpc('artist_page', { p_handle: handle })
      .then(({ data }) => { if (live) setA(data || null); });
    return () => { live = false; };
  }, [supabase, handle]);

  if (!a) return null;

  async function toggle() {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('artist_follow',
      { p_handle: handle, p_on: !a.following });
    if (error) setErr(error.message);
    else setA({ ...a, following: data.following, followers: data.followers });
    setBusy(false);
  }

  const n = Number(a.followers) || 0;
  return (
    <section className="art-panel" aria-label="Artist">
      <div className="art-head">
        <span className="art-tag">
          <svg className="gchk" style={{ marginLeft: 0 }} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" /><path d="M7 12.5l3.2 3.2L17.2 8.6" />
          </svg>
          Verified artist
        </span>
        <span className="art-name">{a.name}</span>
        {a.genre && <span className="art-genre">{a.genre}</span>}
      </div>

      <div className="art-row">
        <span className="art-count">
          <b>{n.toLocaleString()}</b> {n === 1 ? 'follower' : 'followers'} on Sober Book
        </span>
        {a.is_mine
          ? <Link href="/artist" className="art-link">Edit artist page</Link>
          : (
            <button type="button" className="art-follow" onClick={toggle} disabled={busy}
                    aria-pressed={!!a.following}>
              {a.following ? 'Following ✓' : 'Follow'}
            </button>
          )}
      </div>
      {err && <p className="art-err" role="alert">{err}</p>}

      {Array.isArray(a.links) && a.links.length > 0 && (
        <div>
          <p className="art-sub">Listen &amp; follow</p>
          <div className="art-links" style={{ marginTop: 8 }}>
            {a.links.map((l) => (
              /* rel=noreferrer: the artist's link must never learn the
                 visitor came from a recovery app. Same rule as the
                 Recovery Map link in the drawer. */
              <a key={l.url} className="art-link" href={l.url}
                 target="_blank" rel="noreferrer noopener">{l.label} ↗</a>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="art-sub">Upcoming shows</p>
        {Array.isArray(a.shows) && a.shows.length > 0 ? (
          <ul className="art-shows" style={{ marginTop: 6 }}>
            {a.shows.map((s, i) => {
              const d = new Date(s.date + 'T12:00:00');
              return (
                <li key={i} className="art-show">
                  <span className="art-date">{d.getDate()}<small>{MON[d.getMonth()]}</small></span>
                  <span>
                    <span className="art-venue">
                      {s.url
                        ? <a href={s.url} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>{s.venue} ↗</a>
                        : s.venue}
                    </span>
                    {s.city && <span className="art-city"><br />{s.city}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="art-none" style={{ marginTop: 6 }}>No shows listed right now.</p>}
      </div>
    </section>
  );
}
