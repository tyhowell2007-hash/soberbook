'use client';

import { useState } from 'react';
import Link from 'next/link';

/* Turn a pasted link into the service's own licensed embed.

   WHY EMBEDS AND NOT AUDIO FILES: we never host or stream the track. The
   iframe is Spotify's / YouTube's / Apple's own player, playing under
   their licence, from their servers. Hosting the audio ourselves would be
   a rights problem this project is in no position to have — already
   decided in the v1 spec, and worth restating because it's the kind of
   shortcut that looks harmless right up until it isn't.

   Returns null for anything unrecognised. The row still renders; it just
   links out instead of embedding. Failing soft matters here — a member
   pasting an odd link should get a working row, not a broken screen. */
function embedSrc(url) {
  try {
    const u = new URL(url);

    if (u.hostname === 'open.spotify.com') {
      // /track/ID, /album/ID, /playlist/ID → /embed/<same>
      return `https://open.spotify.com/embed${u.pathname}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname === 'music.apple.com') {
      return `https://embed.music.apple.com${u.pathname}${u.search}`;
    }
  } catch { /* not a URL we can parse */ }
  return null;
}

function service(url) {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('youtu')) return 'YouTube';
  if (url.includes('apple')) return 'Apple Music';
  return 'link';
}

export default function Songs({ songs }) {
  /* Which row has its player open. ONE at a time, and none on load.

     Two reasons, and the second is the real one:
     1. Twelve iframes on a phone is a slow, heavy page.
     2. Nothing in this app makes a sound you didn't ask for. Someone
        opens Sober Book at 2am next to a partner, or on a break at work.
        Audio nobody requested could out them. Autoplay is blocked by
        mobile browsers anyway — but we'd refuse it even if it weren't. */
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
              return (
                <li key={i} className={'rec' + (s.is_mine ? ' mine' : '')}>
                  <div className="rechead">
                    <span className="rtitle">{s.anthem_title || 'Untitled'}</span>
                    <span className="rwho2">
                      {s.display_name}{s.is_mine ? ' · yours' : ''}
                    </span>
                  </div>

                  {open && src ? (
                    <iframe
                      className="player"
                      src={src}
                      title={`${s.anthem_title} on ${service(s.anthem_url)}`}
                      allow="encrypted-media; clipboard-write"
                      loading="lazy"
                    />
                  ) : (
                    <div className="recfoot">
                      {src ? (
                        <button className="play" onClick={() => setPlaying(i)}>
                          ▶ play
                        </button>
                      ) : null}
                      {/* Always offer the way out to their own app — the
                          embed gives a preview unless they're signed in
                          to the service, and some people just prefer it. */}
                      <a className="opento" href={s.anthem_url}
                         target="_blank" rel="noopener noreferrer">
                        open in {service(s.anthem_url)} ↗
                      </a>
                      {open && !src && (
                        <span className="noembed">can&apos;t play this one here</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/me" className="btn">Add or change your song</Link>

        <p className="hint">
          One song each. Nobody is told what you picked and nobody can change
          it but you.
        </p>
      </div>
    </>
  );
}
