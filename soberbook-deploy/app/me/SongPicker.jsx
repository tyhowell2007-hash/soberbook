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
  const [ytText, setYtText] = useState('');
  const [ytErr, setYtErr] = useState('');

  /* A ready-made YouTube search for the exact song they just picked, so
     "find the link" is one tap and a copy rather than a hunt. */
  const ytSearch = 'https://www.youtube.com/results?search_query='
    + encodeURIComponent(value?.anthem_title || '');

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

  /* Pull the 11-character video id out of whatever the member pasted.

     YouTube hands out at least five shapes of link depending on where
     you copied it from — the watch page, the share button, a mobile
     app, a playlist, an embed. Rather than trying to recognise each one,
     this asks the browser to parse the URL properly and then looks in
     the two places an id can be. Anything left over is rejected.

     WHY WE STORE THE ID AND NOT THE LINK: the id ends up inside an
     iframe's src. A whole URL that someone typed is a string that
     decides where the browser goes; eleven characters from a fixed
     alphabet can only ever be a video. Narrow the thing before you
     trust it, not after. */
  function ytId(raw) {
    const s = (raw || '').trim();
    if (!s) return null;
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;      // they pasted just the id
    let u;
    try { u = new URL(s); } catch { return null; }
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/
          .test(u.hostname)) return null;
    const v = u.hostname.endsWith('youtu.be')
      ? u.pathname.slice(1)
      : (u.searchParams.get('v') || u.pathname.split('/').pop());
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
  }

  function onYt(text) {
    setYtText(text);
    if (!text.trim()) { setYtErr(''); onPick({ ...value, anthem_youtube: null }); return; }
    const id = ytId(text);
    if (!id) { setYtErr('That doesn’t look like a YouTube link. It should have youtube.com or youtu.be in it.'); return; }
    setYtErr('');
    onPick({ ...value, anthem_youtube: id });
  }

  function choose(t) {
    setYtText(''); setYtErr('');
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
        <>
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

          {/* ---- the whole song ---- */}
          <label htmlFor="yt" style={{ marginTop: 16 }}>
            Paste the YouTube link {value.anthem_youtube ? '' : '(optional)'}
          </label>
          <input
            id="yt" type="text" disabled={disabled}
            autoComplete="off" spellCheck={false}
            placeholder="https://www.youtube.com/watch?v=…"
            value={ytText}
            onChange={(e) => onYt(e.target.value)}
          />
          <p className="hint">
            Apple only lets us play 30 seconds. A YouTube link makes it the{' '}
            <b>whole song</b>, for anyone who visits you — no account, no
            subscription.{' '}
            <a href={ytSearch} target="_blank" rel="noopener noreferrer">
              Find it on YouTube ↗
            </a>{' '}
            then copy the address from the bar and paste it here.
          </p>
          {ytErr && <div className="err">{ytErr}</div>}
          {value.anthem_youtube && !ytErr && (
            <div className="ok">Got it — visitors will hear the whole song.</div>
          )}
        </>
      )}
    </>
  );
}
