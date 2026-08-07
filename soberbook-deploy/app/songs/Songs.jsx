'use client';

import { useState } from 'react';
import Link from 'next/link';

/* Turn a pasted link into the service's own licensed embed.

   WHY EMBEDS AND NOT AUDIO FILES: we never host or stream the track. The
   iframe is Spotify's / YouTube's / Apple's own player, playing under
   their licence, from their servers. Hosting the audio ourselves would be
   a rights problem this project is in no position to have.

   Returns null for anything unrecognised. The row still renders; it just
   links out instead of embedding. Failing soft matters — a member pasting
   an odd link should get a working row, not a broken screen. */
function embedSrc(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'open.spotify.com') return `https://open.spotify.com/embed${u.pathname}`;
    if (u.hostname === 'youtu.be')         return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname === 'music.apple.com')  return `https://embed.music.apple.com${u.pathname}${u.search}`;
  } catch { /* not a URL we can parse */ }
  return null;
}

function service(url) {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('youtu'))   return 'YouTube';
  if (url.includes('apple'))   return 'Apple Music';
  return 'link';
}

/* The waveform.

   ⚠️ BE HONEST ABOUT WHAT THIS IS. It is NOT the real waveform of the
   track — it can't be. Reading a real waveform means having the audio
   file, and we deliberately never touch the audio. That's the licensing
   decision, and drawing a "real" waveform would mean undoing it.

   So this is a signature, not a measurement: the bar heights are derived
   from the song's own title, the same way a post's rotation is derived
   from its id. Consequences of doing it that way:

     • the same song always draws the same shape, on every phone, forever
     • two different songs never look alike
     • it costs nothing and never lies about being analysis

   Random bars would look identical in a screenshot and reshuffle on every
   render, which reads as decoration. A stable shape reads as identity. */
function bars(seedText, count = 44) {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) | 0;
  const out = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    // a gentle arc so the middle is louder than the ends, like a real track
    const arc = Math.sin((i / (count - 1)) * Math.PI) * 0.55 + 0.45;
    out.push(Math.round((18 + (h % 82)) * arc));
  }
  return out;
}

export default function Songs({ songs }) {
  /* Which row has its player open. ONE at a time, and none on load.

     Two reasons, and the second is the real one:
     1. A dozen iframes on a phone is a slow, heavy page.
     2. Nothing in this app makes a sound you didn't ask for. Someone
        opens Sober Book at 2am next to a partner, or on a break at work.
        Audio nobody requested could out them. Mobile browsers block
        autoplay anyway — but we'd refuse it even if they didn't. */
  const [playing, setPlaying] = useState(null);

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">songs</span>
      </div>
      <div className="bar">The songs that got this room here</div>

      <div className="pad">
        {songs.length === 0 ? (
          <div className="empty">
            <div className="h">No songs up yet.</div>
            <div className="p">
              Be the first. Whatever was playing when it started<br />
              turning around — that one.
            </div>
          </div>
        ) : (
          <ul className="songs">
            {songs.map((s, i) => {
              const src = embedSrc(s.anthem_url);
              const open = playing === i;
              const title = s.anthem_title || 'Untitled';
              const wave = bars(title + s.display_name);

              return (
                <li key={i} className={'rec' + (s.is_mine ? ' mine' : '')}>
                  {open && src ? (
                    <>
                      <div className="nowplaying">
                        <span className="npdot" /> now playing · {title}
                      </div>
                      <iframe
                        className="player"
                        src={src}
                        title={`${title} on ${service(s.anthem_url)}`}
                        allow="encrypted-media; clipboard-write"
                        loading="lazy"
                      />
                      <button className="stopit" onClick={() => setPlaying(null)}>
                        ✕ close player
                      </button>
                    </>
                  ) : (
                    <>
                      {/* The whole card is the play target, not a small
                          button in a corner. On a phone that matters more
                          than it looks like it should. */}
                      <button
                        className="deck"
                        onClick={() => src && setPlaying(i)}
                        disabled={!src}
                        aria-label={src ? `Play ${title}` : `${title} — can't play here`}
                      >
                        <span className="cue">{src ? '▶' : '♪'}</span>

                        <span className="wave" aria-hidden="true">
                          {wave.map((b, k) => (
                            <span key={k} className="bar2" style={{ height: b + '%' }} />
                          ))}
                        </span>
                      </button>

                      <div className="recmeta">
                        <span className="rtitle">{title}</span>
                        <span className="rwho2">
                          {s.display_name}{s.is_mine ? ' · yours' : ''}
                          <a className="opento" href={s.anthem_url}
                             target="_blank" rel="noopener noreferrer">
                            {service(s.anthem_url)} ↗
                          </a>
                        </span>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/me" className="btn">Add or change your song</Link>

        <p className="hint">
          One song each. Nobody is told what you picked and nobody can change
          it but you. The shape on each card is drawn from the song&apos;s
          name — it isn&apos;t the real waveform, because we never touch the
          audio itself.
        </p>
      </div>
    </>
  );
}
