'use client';

import { useEffect, useRef, useState } from 'react';

const BARS = 40;

function service(url = '') {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('youtu'))   return 'YouTube';
  if (url.includes('apple'))   return 'Apple Music';
  return 'the service';
}

/* =====================================================================
   THE PLAYER — with sound waves that are actually the sound.

   The old version drew fake bars from the song's title. It looked fine
   in a screenshot and meant nothing. This one reads the audio while it
   plays and the bars are the real frequencies coming out of the speaker.

   HOW THAT WORKS, IN PLAIN ENGLISH

   A browser can put an <audio> element inside a little pipeline. Sound
   goes in one end, comes out the speaker at the other, and you can clip
   things onto the middle of the pipe. One of those things is an
   "analyser" — a meter that, sixty times a second, tells you how loud
   each pitch is right now: bass on the left, treble on the right.

   That list of numbers IS the bars. No guessing, no seeded randomness.
   If the song drops out, the bars drop out.

   ⚠️ FOUR THINGS THAT BREAK THIS, ALL OF THEM SILENTLY

   1. crossOrigin MUST be set BEFORE src.
      Reading audio from another website is a privacy matter — otherwise
      any page could load a private stream and inspect it. So the browser
      only lets you read it if it asked permission WHEN IT STARTED
      DOWNLOADING. Set src first and the request goes out without the
      permission flag; the sound still plays, and the analyser hands back
      an unbroken row of zeros. Flat bars, no error, nothing in the
      console. I checked Apple's server sends `access-control-allow-origin: *`
      before building any of this, because if it didn't, none of this
      would be possible and the honest move would have been to say so.

   2. createMediaElementSource can only be called ONCE per element, ever.
      Call it a second time and it throws. React re-renders constantly,
      so the obvious version — build the pipeline in the render — would
      work on first play and crash on the second. Hence the refs and the
      `wired` guard: build it once, keep it forever.

   3. Clipping the analyser on REROUTES the sound.
      The moment you connect the element to anything, the direct line to
      the speaker is gone. Forget `analyser.connect(ctx.destination)` and
      you get a perfect, beautiful, completely silent visualiser. I know
      how that sounds. It's the single most common way this goes wrong.

   4. The pipeline starts asleep.
      Browsers suspend audio until a human clicks something — that's the
      rule that stops websites blasting noise at you. So resume() has to
      happen inside the click handler, not on page load.

   WHY THE BARS DON'T USE REACT STATE

   Sixty updates a second through useState would re-render this component
   sixty times a second and make the page crawl. So the animation writes
   heights straight onto the DOM nodes through refs. React state is for
   things that change when a person does something. An animation frame is
   not a person.
   ===================================================================== */
export default function SongPlayer({ song, whose, big = false }) {
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);         // 0..1, for the progress bar
  const [failed, setFailed] = useState(false);

  const audio   = useRef(null);
  const wrap    = useRef(null);              // holds the bar <span>s
  const ctxRef  = useRef(null);
  const anRef   = useRef(null);
  const wired   = useRef(false);             // see gotcha 2
  const raf     = useRef(0);

  const canPlay = !!song?.anthem_preview;

  /* Build the pipeline. Once, lazily, inside a click. */
  function wireUp() {
    if (wired.current) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio.current);
      const an  = ctx.createAnalyser();

      /* fftSize decides how finely we chop the sound up. 128 gives 64
         numbers back, we draw 40 of them. Bigger is more detailed and
         also more jittery — at this size the bars move like music
         instead of like static. */
      an.fftSize = 128;
      /* How much each frame is allowed to differ from the last. 0 is
         twitchy and unreadable; 0.8 is syrup. This is the setting that
         makes it feel like it's dancing rather than flickering. */
      an.smoothingTimeConstant = 0.72;

      src.connect(an);
      an.connect(ctx.destination);           // ⚠️ gotcha 3 — do not remove

      ctxRef.current = ctx;
      anRef.current  = an;
      wired.current  = true;
      return true;
    } catch {
      return false;                          // no Web Audio → silent bars, still plays
    }
  }

  function draw() {
    const an = anRef.current;
    const box = wrap.current;
    if (!an || !box) return;

    const data = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(data);

    const kids = box.children;
    for (let i = 0; i < kids.length; i++) {
      /* Human hearing is squashed toward the low end, and so is most
         music — read the bins evenly and the right half of the display
         is dead air on nearly every song. Sampling on a curve spreads
         the interesting part across the whole width. */
      const t = i / (kids.length - 1);
      const bin = Math.min(data.length - 1, Math.round(Math.pow(t, 1.7) * (data.length - 1)));
      const v = data[bin] / 255;
      kids[i].style.height = (6 + v * 94).toFixed(1) + '%';
    }
    raf.current = requestAnimationFrame(draw);
  }

  async function toggle() {
    const a = audio.current;
    if (!a || !canPlay) return;

    if (on) {
      a.pause();
      return;                                // the 'pause' listener flips state
    }

    /* Order matters and this is gotcha 1. The element is created with no
       src at all; we set crossOrigin first, then the src, so the very
       first byte is requested with permission attached. */
    if (a.src !== song.anthem_preview) {
      a.crossOrigin = 'anonymous';
      a.src = song.anthem_preview;
    }

    const ok = wireUp();
    if (ok && ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();         // gotcha 4
    }

    try {
      await a.play();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  /* One place that owns "is it playing", listening to the element itself
     rather than to our own button. If the phone pauses it — a call comes
     in, headphones come out, another app takes over — the UI still tells
     the truth. Trusting the click instead of the element is how you end
     up with a pause button over silence. */
  useEffect(() => {
    const a = audio.current;
    if (!a) return;

    const onPlay  = () => { setOn(true);  cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); };
    const onStop  = () => { setOn(false); cancelAnimationFrame(raf.current); flatten(); };
    const onTime  = () => setPos(a.duration ? a.currentTime / a.duration : 0);
    const onEnd   = () => { setOn(false); setPos(0); cancelAnimationFrame(raf.current); flatten(); };
    const onError = () => { setFailed(true); setOn(false); };

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onStop);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onStop);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onError);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flatten() {
    const box = wrap.current;
    if (!box) return;
    for (const k of box.children) k.style.height = '6%';
  }

  /* Leaving the page stops the sound. Without this, navigating away from
     someone's profile leaves their song playing over the next screen —
     which is exactly the kind of "audio I didn't ask for" this app has
     no business doing. */
  useEffect(() => () => {
    try { audio.current?.pause(); } catch {}
    try { ctxRef.current?.close(); } catch {}
  }, []);

  if (!song?.anthem_url) return null;

  return (
    <div className={'player' + (big ? ' big' : '') + (on ? ' live' : '')}>
      {/* No src attribute here on purpose — see gotcha 1. */}
      <audio ref={audio} preload="none" />

      <div className="pltop">
        {song.anthem_art ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="plart" src={song.anthem_art} alt="" />
        ) : (
          <div className="plart plnone" aria-hidden="true">♪</div>
        )}

        <div className="plmeta">
          {whose && <span className="pllab">{whose}</span>}
          <span className="pltitle">{song.anthem_title || 'Untitled'}</span>
          <a className="plout" href={song.anthem_url}
             target="_blank" rel="noopener noreferrer">
            full song on {service(song.anthem_url)} ↗
          </a>
        </div>
      </div>

      {/* THE SOUND WAVES. Flat until you press play, then they're the
          actual audio. Decorative to a screen reader — it's the same
          information the play button already announces. */}
      <div className="waves" ref={wrap} aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <span key={i} className="wv" style={{ height: '6%' }} />
        ))}
      </div>

      <div className="plbar">
        <button type="button" className={'plbtn' + (on ? ' on' : '')}
                onClick={toggle} disabled={!canPlay}
                aria-label={on ? 'Stop the song' : 'Play the song'}>
          {on ? '❙❙  STOP' : '▶  PLAY'}
        </button>

        <div className="plprog" aria-hidden="true">
          <span style={{ width: (pos * 100).toFixed(1) + '%' }} />
        </div>
      </div>

      {!canPlay && (
        <p className="plnote">
          This one was added as a link, so there&apos;s nothing to play here —
          the arrow above opens it where it lives.
        </p>
      )}
      {failed && (
        <p className="plnote">
          Couldn&apos;t play the preview. The link above still works.
        </p>
      )}
      {canPlay && !on && (
        <p className="plnote">30-second preview. Nothing plays until you press it.</p>
      )}
    </div>
  );
}
