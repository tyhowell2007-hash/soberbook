'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   "ARTISTS ON SOBER BOOK" — the strip under the story rail.  19 Sept.

   ⚠️ ANYONE CAN HIDE IT, AND IT STAYS HIDDEN FOR THEM. This sits on a
   recovery wall; if it ever reads like an ad, the member gets rid of it
   with one tap. Remembered per browser (localStorage) — a convenience,
   not a record.
   Nothing renders until artist_featured() answers with at least one
   artist, so an empty strip never teaches people the feature is broken.
   Avatars go through /api/photo/sign, same door as the story rail.
   ===================================================================== */
const KEY = 'sb-artists-hidden';

export default function ArtistStrip() {
  const [list, setList] = useState([]);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let h = false;
    try { h = localStorage.getItem(KEY) === '1'; } catch { h = false; }
    setHidden(h);
    if (h) return undefined;
    let live = true;
    (async () => {
      const { data } = await browserClient().rpc('artist_featured');
      const rows = Array.isArray(data) ? data : [];
      const paths = [...new Set(rows.map((r) => r.display_avatar_photo).filter(Boolean))];
      let urls = {};
      if (paths.length) {
        try {
          const res = await fetch('/api/photo/sign', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths }),
          });
          urls = (await res.json()).urls || {};
        } catch { /* initials instead */ }
      }
      if (live) setList(rows.map((r) => ({ ...r, face: urls[r.display_avatar_photo] || null })));
    })();
    return () => { live = false; };
  }, []);

  if (hidden || !list.length) return null;

  function hide() {
    try { localStorage.setItem(KEY, '1'); } catch { /* still hides for now */ }
    setHidden(true);
  }

  return (
    <section className="art-strip" aria-label="Artists on Sober Book">
      <div className="art-band">
        <span>♪ Artists on Sober Book</span>
        <button type="button" className="art-hide" onClick={hide}>Hide</button>
      </div>
      <div className="art-cards">
        {list.map((r) => (
          <Link key={r.handle} href={`/u/${r.handle}`} className="art-card">
            <span className="art-face" aria-hidden="true">
              {r.face
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={r.face} alt="" />
                : (r.display_avatar || String(r.name || r.handle).slice(0, 1).toUpperCase())}
            </span>
            <b>
              {r.name}
              <svg className="gchk" viewBox="0 0 24 24" aria-label="Verified artist" role="img">
                <circle cx="12" cy="12" r="11" /><path d="M7 12.5l3.2 3.2L17.2 8.6" />
              </svg>
            </b>
            {r.genre && <small>{r.genre}</small>}
          </Link>
        ))}
      </div>
    </section>
  );
}
