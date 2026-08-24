'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import * as sa from '../../lib/song-audio';

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
  const [offNow, setOffNow] = useState(false);
  /* just this page, no write — see the two-step note below */
  const [hushed, setHushed] = useState(false);

  /* ⚠️ NO PRIVATE <audio> AND NO PRIVATE AudioContext ANY MORE.
     Both now live in lib/song-audio.js, shared by the whole app, because
     iOS blesses an ELEMENT rather than a page — a fresh element per
     profile is refused on a phone every single time. See that file. */
  const wrap = useRef(null);
  const raf  = useRef(0);

  /* Who this instance is, for claiming the one speaker. /me renders two
     SongPlayers at once, so "am I the one playing?" has to be answerable. */
  const me = useId();
  const [, bump] = useState(0);          // re-render when the floor changes

  const canPreview = !!song?.anthem_preview;
  const canFull    = !!song?.anthem_youtube;

  /* wireUp() used to live here, building an AudioContext per instance.
     Deleted rather than left alongside — lib/song-audio.js is now the only
     place that touches Web Audio, so there is no second copy to drift. */

  function draw() {
    const an = sa.analyser(), box = wrap.current;
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
    /* No preview but we do have the whole song? Skip act one entirely
       rather than showing a play button that does nothing. */
    if (!canPreview) { if (canFull) setStage('full'); return; }

    if (sa.owns(me)) { sa.pause(me); return; }

    try {
      /* IT LOOPS. This is the MySpace part: the song stays with you for
         as long as you're on the page rather than stopping after one
         pass. ⚠️ Setting loop means the 'ended' event NEVER fires — a
         looping element does not end — so the way to the full song
         cannot live at the end of the preview. It's the chip instead. */
      await sa.play(me, song.anthem_preview, { loop: true });
      setFailed(false);
    } catch {
      /* The only way here on a phone is an element the person has never
         tapped — i.e. they cold-opened this profile as their very first
         action. The ▶ button is still sitting there, and pressing it IS
         the gesture, so the second attempt always works. */
      setFailed(true);
    }
  }

  /* Listen to the ELEMENT, not to our own button. If the phone pauses it
     — a call lands, headphones come out — the screen still tells the
     truth. Trusting the click is how you end up with a pause button
     sitting over silence. */
  useEffect(() => {
    const a = sa.element();

    /* ⚠️ EVERY HANDLER ASKS "IS IT MINE?" FIRST.

       There is one element for the whole app now, so this instance hears
       the events of a song it may not be playing. /me renders two of
       these side by side; without the guard, starting the preview of a
       new song would light up the pause button on your existing anthem
       as well. One speaker, one owner, and the screen has to agree. */
    const mine = () => sa.current() === me;

    const onPlay = () => {
      if (!mine()) { setStage('idle'); cancelAnimationFrame(raf.current); flatten(); return; }
      setStage('preview');
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(draw);
    };
    const onPause = () => {
      setStage((st) => (st === 'preview' ? 'idle' : st));
      cancelAnimationFrame(raf.current); flatten();
    };
    const onTime = () => { if (mine()) setPos(a.duration ? a.currentTime / a.duration : 0); };
    const onEnd  = () => { cancelAnimationFrame(raf.current); flatten(); setPos(0); setStage('idle'); };
    const onErr  = () => { if (mine()) { setFailed(true); setStage('idle'); } };

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    /* The floor changing hands is not a media event, so it needs its own
       channel — otherwise the instance that just LOST the speaker never
       finds out and keeps drawing a pause button. */
    const off = sa.onChange(() => bump((n) => n + 1));
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      off();
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFull]);

  /* Leaving the page stops the sound. Without this, walking off someone's
     profile leaves their song playing over the next screen — exactly the
     kind of audio nobody asked for that this app has no business making.

     🔴 RELEASE, NOT CLOSE. This used to call ctxRef.current.close(). With
     one shared AudioContext that would be catastrophic rather than tidy:
     a closed AudioContext can never be reopened, so the first profile you
     walked away from would kill sound for the rest of the session. There
     is deliberately no dispose() in lib/song-audio.js for this reason. */
  useEffect(() => () => { sa.release(me); }, [me]);

  /* Autoplay, and it fails quietly on purpose.

     Browsers refuse audio until they've seen a gesture somewhere on the
     site this session, and that refusal is CORRECT. So we attempt it and,
     if it's refused, the big button is still sitting there. No error, no
     nag. On iOS this will be refused more often than not, and that is not
     a bug we can fix from here.

     ---------------------------------------------------------------------
     EVERY PROFILE PLAYS, INCLUDING THE FIRST ONE.

     Ty's call, Aug 15. A first-page-of-the-session grace was built and
     then removed at his direction — he wants it plain: you open a page,
     the song starts. Recording that it was tried, so nobody re-proposes
     it as a new idea.

     The argument against it is still on the record in 0009 and it is not
     silly: a song nobody asked for, out of a recovery app, in a quiet
     room, says something about you that you didn't choose to say. Two
     things carry that weight instead of a grace period —

       1. THE BROWSER. Autoplay is refused until a site has earned enough
          interaction, and a cold first page of a session is exactly the
          case browsers refuse hardest. So in practice the riskiest
          moment is still usually silent, enforced by Chrome and Safari
          rather than by us. We are not relying on that — it just means
          the real-world gap between this and the grace version is small.
       2. THE OFF SWITCH, which is on the page rather than in settings,
          and sticks for good. See stopAutoplaying below. */
  useEffect(() => {
    if (!autoplay || !canPreview || offNow) return;
    /* Already playing this one? Leave it alone — a re-render must never
       restart a song somebody is in the middle of. */
    if (sa.owns(me)) return;
    /* 🔴 NOT BLESSED YET, SO DON'T EVEN TRY. On a phone this call would
       be refused and, worse, the rejection is the only signal we'd get —
       we'd flip `failed` and show an error on a page that is about to
       work fine two seconds later when the person taps something.

       This effect re-runs when the blessing lands (AudioUnlock fires
       notify()), so the cold-open case resolves itself on the first
       touch instead of needing the ▶ button. Ty: "I don't want somebody
       to have to push a button to hear it because they won't." */
    if (!sa.isBlessed()) return;

    let dead = false;
    (async () => { try { if (!dead) await play(); } catch {} })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, canPreview, offNow, sa.isBlessed()]);

  /* Turning autoplay off from the page you're standing on.

     It already lives on /me, but a setting three taps away is no use to
     somebody whose phone just started playing music in a quiet room. The
     control has to be where the sound is.

     Writes straight to the listener's own row — same column the /me
     toggle uses, so the two can't disagree. Optimistic: the sound stops
     immediately and the database catches up, because making a person
     wait on a round trip to stop audio they didn't want is the wrong way
     round. If the write fails they're still silenced for this page and
     the /me toggle is still there. */
  /* ---- THE OFF SWITCH, IN TWO STEPS ----

     🔴 IT USED TO BE ONE TAP AND PERMANENT, and Ty turned it off twice by
     accident in a single day without realising. The button said "Stop
     starting songs for me", which reads like it's about THIS song; it
     actually silenced every profile in the app, forever, with no
     confirmation and nothing to undo it from.

     ⭐ Splitting it keeps the thing it was built for and removes the trap.
     The first tap still silences the room INSTANTLY with one press —
     that's the whole reason it lives under the song rather than in
     settings, and somebody whose phone just started playing music in a
     quiet meeting needs exactly that. But the first tap writes NOTHING.
     Turning it off for good is a separate, deliberate second press.

     ⚠️ The one-tap emergency stop must not be weakened further. Do not
     put a confirmation dialog on step one. */
  function hushThisOne() {
    sa.pause(me);
    setHushed(true);
  }

  async function neverAgain() {
    sa.pause(me);
    setOffNow(true);
    try {
      const supabase = browserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles')
        .update({ autoplay_songs: false }).eq('id', user.id);
    } catch {}
  }

  if (!song?.anthem_url) return null;

  /* ⚠️ Ownership, not just stage. Two players share one element, so
     "is a song playing?" and "is MY song playing?" are different
     questions and only the second one should light up this button. */
  const live = stage === 'preview' && sa.owns(me);
  const title = song.anthem_title || 'Untitled';

  return (
    <div className={'sleeve' + (big ? ' big' : '') + (live ? ' live' : '')}>
      {/* ⚠️ NO <audio> TAG HERE ANY MORE. The element is a single shared
          object created in lib/song-audio.js and never mounted, because
          the iOS blessing lives on the element and React would throw a
          new one away on every navigation. Rendering one here again would
          silently reintroduce the phone bug. */}
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

      {/* The off switch, where the sound is.

          Only shown to somebody who has autoplay on — there is nothing to
          turn off on a page that was never going to play. Once tapped it
          becomes a plain statement rather than vanishing, so the tap
          visibly did something. */}
      {/* STEP ONE — always one tap, always instant, never writes. */}
      {autoplay && !offNow && !hushed && (
        <button type="button" className="soff" onClick={hushThisOne}>
          Stop the music
        </button>
      )}

      {/* STEP TWO — offered only after they've already silenced it, so
          the permanent change is a considered second act rather than
          something you can do by brushing the screen. */}
      {hushed && !offNow && (
        <div style={{ marginTop: 6, paddingLeft: 10,
                      borderLeft: '2px solid var(--line, #D8E3DC)' }}>
          {/* ⚠️ Inlined rather than a class in wall.css, deliberately.
              That file is 71KB and GitHub's uploader has silently dropped
              it on three of four deploys — not worth making it travel for
              three cosmetic lines. When wall.css is properly split, this
              belongs in the player's own stylesheet.

              ⚠️ And it lives INSIDE the div, not beside it: a JSX comment
              is an expression, so a comment next to an element inside a
              && is two children with no parent. The build caught it. */}
          <p className="snote">Stopped.</p>
          <button type="button" className="soff" onClick={neverAgain}>
            Don&apos;t start songs on any profile again
          </button>
        </div>
      )}

      {offNow && (
        <p className="snote">
          Off everywhere. You can turn it back on under <b>You → the pencil → settings</b>.
        </p>
      )}

      {failed && <p className="snote">Couldn&apos;t play it. The link above still works.</p>}
      {!canPreview && !canFull && (
        <p className="snote">Added as a link — the arrow opens it where it lives.</p>
      )}
    </div>
  );
}
