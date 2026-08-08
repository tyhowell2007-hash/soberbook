'use client';

import { useEffect, useRef, useState } from 'react';

const BARS = 56;

function service(url = '') {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('youtu'))   return 'YouTube';
  if (url.includes('apple'))   return 'Apple Music';
  return 'the service';
}

/* =====================================================================
   THE SLEEVE — two acts in one square.

   ACT ONE is Apple's 30-second preview with a REAL waveform: the bars
   are the actual audio, read sixty times a second while it plays.
   ACT TWO is the whole song, from YouTube, in the same frame.

   WHY IT HAS TO BE TWO ACTS, and this is not a shortcut:

   Licensed music is encrypted. Spotify, Apple Music and YouTube all wrap
   the stream so that no web page can read the samples — that encryption
   is the entire reason rights-holders allow browser playback at all.
   Point an analyser at any of them and you get silence, by design.

   Apple's PREVIEW is the one piece of music on the internet handed over
   unencrypted, to anyone, with no account. That is the only reason a
   real waveform is possible here. So the preview is where the waveform
   lives, and the full song takes over when it runs out.

   Anyone who tells you they've got reactive waveforms on full streaming
   audio in a browser is either licensed at a level we are not, or the
   bars are decorative. Ours are not decorative — which is exactly why
   they can only run for thirty seconds.

   ⚠️ FOUR THINGS THAT SILENTLY BREAK ACT ONE

   1. crossOrigin MUST be set BEFORE src. Reading audio from another site
      needs permission asked at DOWNLOAD time. Set src first and the
      sound still plays while the analyser returns an unbroken row of
      zeros — flat bars, no error, nothing in the console.
   2. createMediaElementSource runs ONCE per element, ever. Twice throws.
      React re-renders constantly, so the wiring lives in refs behind a
      guard, built once and kept.
   3. Connecting the analyser REROUTES the sound. Forget
      analyser.connect(ctx.destination) and you get a perfect, silent
      visualiser. It is the most common way this goes wrong.
   4. The audio pipeline starts suspended. Browsers keep it asleep until
      a human clicks, so resume() belongs inside the click handler.

   And the bars are written straight onto the DOM through refs, never
   through React state — sixty re-renders a second would make the page
   crawl. State is for things a person changes. A frame is not a person.
   ===================================================================== */
export default function SongPlayer({ song, whose, big = false, autoplay = false }) {
  const [stage, setStage] = useState('idle');   // idle · preview · full · offer
  const [pos, setPos] = useState(0);
  const [failed, setFailed] = useState(false);

  const audio  = useRef(null);
  const wrap   = useRef(null);
  const ctxRef = useRef(null);
  const anRef  = useRef(null);
  const wired  = useRef(false);
  const raf    = useRef(0);

  const canPreview = !!song?.anthem_preview;
  const canFull    = !!song?.anthem_youtube;

  function wireUp() {
    if (wired.current) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio.current);
      const an  = ctx.createAnalyser();
      /* 256 gives 128 numbers back and we draw 56 of them. Enough detail
         to see the shape of a snare without turning into static. */
      an.fftSize = 256;
      /* How much a frame may differ from the last. 0 is a seizure, 0.85
         is syrup. This is the number that makes it move like music. */
      an.smoothingTimeConstant = 0.7;
      src.connect(an);
      an.connect(ctx.destination);            // ⚠️ gotcha 3 — do not remove
      ctxRef.current = ctx; anRef.current = an; wired.current = true;
      return true;
    } catch { return false; }
  }

  function draw() {
    const an = anRef.current, box = wrap.current;
    if (!an || !box) return;
    const data = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(data);
    const kids = box.children;
    for (let i = 0; i < kids.length; i++) {
      /* Music crowds into the low end, so reading the bins evenly leaves
         the right-hand half dead on nearly every song. Sampling on a
         curve spreads the interesting part across the whole width. */
      const t = i / (kids.length - 1);
      const bin = Math.min(data.length - 1,
        Math.round(Math.pow(t, 1.65) * (data.length - 1)));
      const v = data[bin] / 255;
      kids[i].style.height = (4 + v * 96).toFixed(1) + '%';
    }
    raf.current = requestAnimationFrame(draw);
  }

  function flatten() {
    const box = wrap.current;
    if (box) for (const k of box.children) k.style.height = '4%';
  }

  async function play() {
    const a = audio.current;
    if (!a) return;

    /* No preview but we do have the whole song? Skip act one entirely
       rather than showing a play button that does nothing. */
    if (!canPreview) { if (canFull) setStage('full'); return; }

    if (stage === 'preview') { a.pause(); return; }

    /* Order matters — gotcha 1. The element is born with no src. */
    if (a.src !== song.anthem_preview) {
      a.crossOrigin = 'anonymous';
      a.src = song.anthem_preview;
    }
    /* IT LOOPS. This is the MySpace part: the song stays with you for as
       long as you're on the page rather than stopping after one pass.
       ⚠️ Setting loop means the 'ended' event NEVER fires — a looping
       element does not end — so the way to the full song cannot live at
       the end of the preview. It's the chip in the corner instead. */
    a.loop = true;
    const ok = wireUp();
    if (ok && ctxRef.current.state === 'suspended') await ctxRef.current.resume();
    try { await a.play(); setFailed(false); }
    catch { setFailed(true); }
  }

  /* Listen to the ELEMENT, not to our own button. If the phone pauses it
     — a call lands, headphones come out — the screen still tells the
     truth. Trusting the click is how you end up with a pause button
     sitting over silence. */
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onPlay = () => { setStage('preview');
      cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); };
    const onPause = () => { setStage((s) => (s === 'preview' ? 'idle' : s));
      cancelAnimationFrame(raf.current); flatten(); };
    const onTime = () => setPos(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => { cancelAnimationFrame(raf.current); flatten(); setPos(0);
      setStage('idle'); };
    const onErr = () => { setFailed(true); setStage('idle'); };

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFull]);

  /* Leaving the page stops the sound. Without this, walking off someone's
     profile leaves their song playing over the next screen — exactly the
     kind of audio nobody asked for that this app has no business making. */
  useEffect(() => () => {
    try { audio.current?.pause(); } catch {}
    try { ctxRef.current?.close(); } catch {}
  }, []);

  /* Opt-in autoplay, and it fails quietly on purpose.

     The visitor asked for this on their own settings page, so we try. But
     browsers refuse audio until they've seen a gesture somewhere on the
     site this session, and that refusal is CORRECT — it is the thing
     standing between somebody and a room full of people who now know.
     So we attempt it and, if it's refused, the big button is still
     sitting there. No error, no nag. */
  useEffect(() => {
    if (!autoplay || !canPreview || stage !== 'idle') return;
    let dead = false;
    (async () => { try { if (!dead) await play(); } catch {} })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, canPreview]);

  if (!song?.anthem_url) return null;

  const live = stage === 'preview';
  const title = song.anthem_title || 'Untitled';

  return (
    <div className={'sleeve' + (big ? ' big' : '') + (live ? ' live' : '')}>
      {/* born with no src on purpose — gotcha 1 */}
      <audio ref={audio} preload="none" />

      <div className="sframe">
        {song.anthem_art
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img className="sart" src={song.anthem_art} alt="" />
          : <div className="sart snone" aria-hidden="true">♪</div>}

        {/* ACT TWO — the whole song, in the same square.
            ⚠️ The iframe is not rendered until someone asks for it. An
            iframe loads the instant the page does, so merely LOOKING at
            a profile would announce this browser to Google before a note
            played. On a recovery app that is not an acceptable default. */}
        {stage === 'full' && (
          <iframe
            className="sfull"
            src={`https://www.youtube-nocookie.com/embed/${song.anthem_youtube}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}

        {stage !== 'full' && (
          <>
            {/* THE WAVEFORM. Mirrored from the centre line, because that
                is the shape people read as "sound" — bars standing on a
                floor read as a chart. Real audio, only ever real. */}
            <div className={'swave' + (live ? ' on' : '')} ref={wrap} aria-hidden="true">
              {Array.from({ length: BARS }, (_, i) =>
                <span key={i} className="sbar" style={{ height: '4%' }} />)}
            </div>

            <div className="sveil" aria-hidden="true" />
            <div className="stitle">{title}</div>

            {/* The way to the whole song. A chip rather than an
                interstitial, because the preview loops now and so there
                is no "end" to interrupt. */}
            {canFull && (
              <button type="button" className="schip" onClick={() => setStage('full')}>
                whole song ▸
              </button>
            )}

            <button type="button" className={'sbtn' + (live ? ' on' : '')}
                    onClick={play}
                    aria-label={live ? 'Pause' : 'Play'}>
              {live ? '❙❙' : '▶'}
            </button>
          </>
        )}
      </div>

      <div className="sfoot">
        <span className="swho">{whose}</span>
        {stage === 'full' ? (
          <span className="stag full">the whole song</span>
        ) : (
          <span className="sline" aria-hidden="true">
            <span style={{ width: (pos * 100).toFixed(1) + '%' }} />
          </span>
        )}
        <a className="sout" href={song.anthem_url}
           target="_blank" rel="noopener noreferrer">
          {service(song.anthem_url)} ↗
        </a>
      </div>

      {failed && <p className="snote">Couldn&apos;t play it. The link above still works.</p>}
      {!canPreview && !canFull && (
        <p className="snote">Added as a link — the arrow opens it where it lives.</p>
      )}
    </div>
  );
}
