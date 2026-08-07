'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

function service(url = '') {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('youtu'))   return 'YouTube';
  if (url.includes('apple'))   return 'Apple Music';
  return 'the service';
}

/* The fallback shape, for songs added by pasting a link before the search
   existed — those have no artwork.

   ⚠️ IT IS NOT A REAL WAVEFORM and never was. Reading a real one needs the
   audio file, which we deliberately never touch. The bars come from the
   song's own title, the way a post's rotation comes from its id: the same
   song always draws the same shape, two songs never match, and it never
   pretends to be analysis. */
function bars(seed, count = 32) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const out = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const arc = Math.sin((i / (count - 1)) * Math.PI) * 0.55 + 0.45;
    out.push(Math.round((18 + (h % 82)) * arc));
  }
  return out;
}

export default function Songs({ songs }) {
  /* Which card is playing. ONE at a time, none on load.

     Nothing here makes a sound you didn't ask for. Someone opens Sober
     Book at 2am next to a partner, or on a break at work — audio nobody
     requested could out them. Mobile browsers block autoplay anyway; we'd
     refuse it regardless. */
  const [playing, setPlaying] = useState(null);
  const [progress, setProgress] = useState(0);
  const audio = useRef(null);

  /* One <audio> element for the whole page, not one per card.

     Doing it per-card would mean a dozen audio elements each holding a
     buffer, and — worse — two could end up playing at once if a tap
     landed during a transition. A single element makes "only one thing is
     playing" true by construction rather than by careful bookkeeping. */
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => { setPlaying(null); setProgress(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle(i, previewUrl) {
    const a = audio.current;
    if (!a || !previewUrl) return;
    if (playing === i) { a.pause(); setPlaying(null); return; }
    a.src = previewUrl;
    a.play().then(() => setPlaying(i)).catch(() => setPlaying(null));
    setProgress(0);
  }

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">songs</span>
      </div>
      <div className="bar">The songs that got this room here</div>

      {/* the single shared player */}
      <audio ref={audio} preload="none" />

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
              const title = s.anthem_title || 'Untitled';
              const on = playing === i;
              const canPlay = !!s.anthem_preview;

              return (
                <li key={i} className={'rec' + (s.is_mine ? ' mine' : '') + (on ? ' on' : '')}>
                  <div className="recrow">
                    <button
                      className={'art' + (canPlay ? '' : ' noplay')}
                      onClick={() => toggle(i, s.anthem_preview)}
                      disabled={!canPlay}
                      aria-label={canPlay ? (on ? `Pause ${title}` : `Play ${title}`) : title}
                    >
                      {s.anthem_art ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.anthem_art} alt="" />
                      ) : (
                        <span className="wave" aria-hidden="true">
                          {bars(title).map((b, k) => (
                            <span key={k} className="bar2" style={{ height: b + '%' }} />
                          ))}
                        </span>
                      )}
                      {canPlay && <span className="cue">{on ? '❙❙' : '▶'}</span>}
                    </button>

                    <div className="recmeta">
                      <span className="rtitle">{title}</span>
                      <span className="rwho2">
                        {s.display_name}{s.is_mine ? ' · yours' : ''}
                      </span>
                      <a className="opento" href={s.anthem_url}
                         target="_blank" rel="noopener noreferrer">
                        full song on {service(s.anthem_url)} ↗
                      </a>
                    </div>
                  </div>

                  {on && (
                    <div className="prog" aria-hidden="true">
                      <span style={{ width: (progress * 100).toFixed(1) + '%' }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/me" className="btn">Add or change your song</Link>

        <p className="hint">
          One song each. Nobody is told what you picked and nobody can change it
          but you. Tapping plays a 30-second preview from Apple — the full song
          is one tap further, in whatever you already use.
        </p>
      </div>
    </>
  );
}
