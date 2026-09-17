'use client';

import { useState, useRef } from 'react';
import { youtubeId as ytId, spotifyTrackId as spId } from '../../lib/links';

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

/* 🔴 THE SECOND ENDPOINT, AND THE WHOLE REASON THIS FILE CHANGED.

   Jordan Cruz, 16 Sept: "it's the player that isn't pulling mine up for
   some reason idk why." He was right, and it was ours.

   `search?term=…&entity=song` matches the words against SONG TITLES as
   well as artist names, then ranks by popularity. Typing "Jordan Cruz"
   returned, in order: a DIFFERENT artist of the same name, a children's
   record, and three copies of a band's song that is literally TITLED
   "Jordan Cruz". Six slots, none of them his — while his own thirteen
   tracks sat one lookup away.

   ⚠️ `attribute=artistTerm` IS NOT THE FIX, and it is the obvious thing
   to reach for. Tried at limit=25: still no sign of him, because the
   fuzzy match spends the slots on Jordan Critz and friends. Verified
   against the live API before this was written, not assumed.

   ⭐ What DOES work is asking a narrower question. `entity=musicArtist`
   returns ARTISTS, and there he is, first. Then /lookup with his artist
   id returns his catalogue exactly — no ranking, no guessing, no ceiling.
   An unsigned artist with fifty listeners resolves the same as a famous
   one, which is the entire point on this app. */
const LOOKUP = 'https://itunes.apple.com/lookup';

/* ⭐ SPOTIFY, WITHOUT A KEY. Their Web API is shut to an app this size —
   Development Mode allows FIVE authorised users and the quota that lifts
   it wants 250,000 monthly actives — so the search above stays Apple's.
   But oembed is open to anyone, answers `access-control-allow-origin: *`
   and hands back a title and a sleeve for a link somebody already has.
   That is the whole Spotify road, and it needs no secret to walk it.

   ⚠️ It cannot SEARCH. It only ever describes a link you give it. */
const OEMBED = 'https://open.spotify.com/oembed';

/* Names compared with the punctuation and case thrown away, because
   "JORDAN CRUZ", "Jordan Cruz" and "jordan-cruz" are one person. */
const bare = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ⚠️ DELIBERATELY EXACT, not "contains". A loose test would treat
   somebody typing one word — "jordan" — as naming an artist and bury the
   song they were actually looking for under a stranger's back catalogue.
   The bar for hijacking the results list is that they typed the name. */
function namedArtist(artistName, typed) {
  const a = bare(artistName);
  return a.length > 2 && a === bare(typed);
}

export default function SongPicker({ value, onPick, disabled }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);   // null = haven't searched yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ytText, setYtText] = useState('');
  const [ytErr, setYtErr] = useState('');
  const [spText, setSpText] = useState('');
  const [spErr, setSpErr] = useState('');
  const [spBusy, setSpBusy] = useState(false);

  /* ⚠️ THE SEARCH NOW MAKES UP TO FOUR REQUESTS PER KEYSTROKE-BURST and
     they do not come back in the order they left. The debounce below
     stops nine searches firing; it does NOT stop the answer to "jord"
     landing after the answer to "jordan cruz" and overwriting it. This
     counter is what does: every run takes a ticket, and a run that is no
     longer the newest throws its own answer away. */
  const seq = useRef(0);

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
      const mine = ++seq.current;
      setBusy(true);
      try {
        const typed = text.trim();
        const term  = encodeURIComponent(typed);

        /* Both questions at once. The song search is the one that has to
           work; the artist search is a bonus and is never allowed to
           fail the whole thing. */
        const [songRes, artistRes] = await Promise.all([
          fetch(`${SEARCH}?term=${term}&entity=song&limit=12`),
          fetch(`${SEARCH}?term=${term}&entity=musicArtist&limit=5`),
        ]);
        if (!songRes.ok) throw new Error('search is not answering right now');
        const songs = (await songRes.json()).results || [];

        /* ⚠️ TWO artists, not one. There are THREE people called Jordan
           Cruz on Apple Music and a name is not a key. Taking only the
           top one would quietly pick a stranger for somebody whose
           namesake happens to rank higher. */
        let owned = [];
        if (artistRes.ok) {
          const named = ((await artistRes.json()).results || [])
            .filter((a) => namedArtist(a.artistName, typed))
            .slice(0, 2);

          owned = (await Promise.all(named.map((a) =>
            fetch(`${LOOKUP}?id=${a.artistId}&entity=song&limit=25`)
              .then((r) => (r.ok ? r.json() : { results: [] }))
              /* lookup answers with the ARTIST first and the tracks
                 after, so the wrapperType check is not optional — an
                 artist row has no trackName and renders as a blank. */
              .then((d) => (d.results || []).filter((x) => x.wrapperType === 'track'))
              .catch(() => [])
          ))).flat();
        }

        if (mine !== seq.current) return;   // a newer keystroke won

        /* Their own songs first, then everything else, and no track
           twice. ⚠️ The dedupe is REQUIRED, not tidiness: the same
           record legitimately arrives from both roads, and React pairs
           it with a duplicate key and drops one at random. */
        const seen = new Set();
        setHits([...owned, ...songs].filter((t) => {
          if (!t.trackId || seen.has(t.trackId)) return false;
          seen.add(t.trackId);
          return true;
        }));
      } catch (e) {
        if (mine !== seq.current) return;
        setErr('Couldn’t reach the music search. You can still paste a link below.');
        setHits(null);
      } finally {
        if (mine === seq.current) setBusy(false);
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
  /* ⚠️ ytId used to live here. It now lives in lib/links.js and is
     imported, because the wall needed the same parser — and two copies
     of a hostname check is how one of them quietly stops matching a
     domain the other one blocks. The 0046 → 0049 lesson. */

  function onYt(text) {
    setYtText(text);
    if (!text.trim()) { setYtErr(''); onPick({ ...value, anthem_youtube: null }); return; }
    const id = ytId(text);
    if (!id) { setYtErr('That doesn’t look like a YouTube link. It should have youtube.com or youtu.be in it.'); return; }
    setYtErr('');
    onPick({ ...value, anthem_youtube: id });
  }

  /* THE SPOTIFY FIELD.

     ⚠️ The id alone is enough to PLAY the song. Everything after it here
     is only so that somebody who pasted a link WITHOUT searching first
     still ends up with a title and a sleeve — which is the artist, every
     time. So the oembed call is allowed to fail quietly: a song that
     plays under the word "Untitled" beats a refusal. */
  async function onSp(text) {
    setSpText(text);
    if (!text.trim()) {
      setSpErr('');
      onPick({ ...value, anthem_spotify: null });
      return;
    }
    const id = spId(text);
    if (!id) {
      setSpErr('That doesn\u2019t look like a Spotify track link. In Spotify, tap the \u22ef on the song \u2192 Share \u2192 Copy link.');
      return;
    }
    setSpErr('');

    const next = { ...value, anthem_spotify: id };

    if (!value?.anthem_url) {
      next.anthem_url = `https://open.spotify.com/track/${id}`;
      setSpBusy(true);
      try {
        const r = await fetch(`${OEMBED}?url=${encodeURIComponent(next.anthem_url)}`);
        if (r.ok) {
          const d = await r.json();
          /* ⚠️ 120 is the database's own cap on anthem_title. Trimming
             here rather than letting the save bounce means the limit is
             felt as a shorter title, not as a red error on a field the
             member never typed into. */
          if (d.title) next.anthem_title = String(d.title).slice(0, 120);
          /* ⚠️ oembed gives NO artist as its own field — only the track
             title — so a Spotify-only pick reads "Song" where an Apple
             pick reads "Song \u2014 Artist". Worth knowing before somebody
             files it as a bug. */
          if (d.thumbnail_url) next.anthem_art = d.thumbnail_url;
        }
      } catch {
        /* Deliberately silent. See the note at the head of this function. */
      }
      setSpBusy(false);
    }

    onPick(next);
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
        <p className="hint">Nothing found. Check the spelling, or paste a link below.</p>
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

          {/* ---- or Spotify ---- */}
          <label htmlFor="sp" style={{ marginTop: 16 }}>
            Paste the Spotify link {value.anthem_spotify ? '' : '(optional)'}
          </label>
          <input
            id="sp" type="text" disabled={disabled}
            autoComplete="off" spellCheck={false}
            placeholder="https://open.spotify.com/track/…"
            value={spText}
            onChange={(e) => onSp(e.target.value)}
          />
          <p className="hint">
            {spBusy ? 'Reading it…' : 'If it\u2019s your own music, this is the one to use.'}
            {' '}Visitors signed in to Spotify hear the whole song; everyone else
            gets a preview. Nothing loads from Spotify until somebody taps play.
          </p>
          {spErr && <div className="err">{spErr}</div>}
          {value.anthem_spotify && !spErr && (
            <div className="ok">Got it — your page will play it from Spotify.</div>
          )}
        </>
      )}
    </>
  );
}
