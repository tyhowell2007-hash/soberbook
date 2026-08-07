'use client';

import { useState, useRef } from 'react';

/* Pick your song in two steps: type a name, tap a result.

   THE VERSION THIS REPLACES took six — leave the app, find the song, hit
   share, copy the link, come back, paste, then type the title as well.
   I'd argued the playlist was the LOW-friction way into Sober Book and
   then built the highest-friction thing in it.

   WHY APPLE'S SEARCH AND NOT SPOTIFY'S: Spotify's API needs an app
   registration, a client secret, and a server-side token refresh — a
   login and a moving part, to look up a song title. Apple's iTunes Search
   endpoint needs none of that. No key, no account, and it sends
   `access-control-allow-origin: *`, so the browser can call it directly.

   WHAT WE GET BACK that a pasted link could never give us: the artist,
   real album artwork, and a 30-second preview we're allowed to play. So
   the card stops being a link and becomes an actual record.

   WHAT THIS COSTS, said plainly: the search text leaves the member's
   browser and goes to Apple. Apple sees an IP address and a song name —
   the same as typing it into any music app. It does NOT go through our
   server, so we never see or store what anyone searched for. That felt
   like the right trade, but it IS a trade and the UI says so. */
const SEARCH = 'https://itunes.apple.com/search';

export default function SongPicker({ value, onPick, disabled }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);   // null = haven't searched yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  /* One timer, reused. Without this, "alive pod" fires nine searches —
     one per keystroke — and the answers can arrive out of order, so the
     list you end up looking at is whichever request happened to be
     slowest, not the one matching what you typed. */
  const timer = useRef(null);

  function onType(text) {
    setQ(text);
    setErr('');
    clearTimeout(timer.current);

    if (text.trim().length < 2) { setHits(null); return; }

    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const url = `${SEARCH}?term=${encodeURIComponent(text.trim())}`
                  + `&entity=song&limit=6`;
        const r = await fetch(url);
        if (!r.ok) throw new Error('search is not answering right now');
        const data = await r.json();
        setHits(data.results || []);
      } catch (e) {
        setErr('Couldn’t reach the music search. You can still paste a link below.');
        setHits(null);
      } finally {
        setBusy(false);
      }
    }, 350);
  }

  function choose(t) {
    onPick({
      // trackViewUrl is a music.apple.com link, which is what the
      // anthem_url constraint already allows
      anthem_url: t.trackViewUrl,
      anthem_title: `${t.trackName} — ${t.artistName}`,
      // 100px is what the API hands back; asking for 300 is just a string
      // swap on their CDN and the card looks far better for it
      anthem_art: (t.artworkUrl100 || '').replace('100x100', '300x300') || null,
      anthem_preview: t.previewUrl || null,
    });
    setQ('');
    setHits(null);
  }

  return (
    <>
      <label htmlFor="sq">Search for it</label>
      <input
        id="sq" type="text" value={q} disabled={disabled}
        autoComplete="off" spellCheck={false}
        onChange={(e) => onType(e.target.value)}
        placeholder="alive pod"
      />
      <p className="hint">
        Type a song or artist. {busy ? 'Looking…' : 'Tap the one you mean.'}
        {' '}Your search goes to Apple, not to us — we never see what you typed.
      </p>

      {err && <div className="err">{err}</div>}

      {hits && hits.length === 0 && (
        <p className="hint">Nothing found. Try the artist&apos;s name too.</p>
      )}

      {hits && hits.length > 0 && (
        <ul className="hits">
          {hits.map((t) => (
            <li key={t.trackId}>
              <button type="button" className="hit" onClick={() => choose(t)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.artworkUrl100} alt="" width={48} height={48} />
                <span className="hitmeta">
                  <span className="hittitle">{t.trackName}</span>
                  <span className="hitartist">{t.artistName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value?.anthem_title && (
        <div className="picked">
          {value.anthem_art && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value.anthem_art} alt="" width={56} height={56} />
          )}
          <span className="pickedmeta">
            <span className="pickedlab">your song</span>
            <span className="pickedtitle">{value.anthem_title}</span>
          </span>
        </div>
      )}
    </>
  );
}
