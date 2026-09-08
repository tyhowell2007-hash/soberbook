/* =====================================================================
   MAKE A PHONE VIDEO SMALL ENOUGH TO POST, ON THE PHONE.

   🔴 WHY THIS EXISTS. Ty, 8 Sept: "we're gonna have to make it to where
   people can just upload it from their phone because that's how it's
   gonna be." He spent an entire evening unable to put up a two-minute
   clip. Measured off his real file: 2160x3840 HEVC at 28.6 Mbps — a
   TWO MINUTE video weighing 412MB.

   Against the 50MB ceiling that means, on default settings:

       iPhone 4K 60fps  →   8 seconds fits
       iPhone 4K 30fps  →  14 seconds fits
       iPhone 1080p 30  →  50 seconds fits

   ⭐ So we did not have a video feature, we had a ten-second-clip
   feature — and nobody was going to email us about it, they were going
   to decide the app was broken. Which is exactly what Ty did, and he
   OWNS the thing.

   ---------------------------------------------------------------------
   ⚠️ THE COST, STATED HONESTLY: THIS RUNS IN REAL TIME.

   MediaRecorder encodes as the video plays. Two minutes of footage takes
   two minutes. Measured on the real path: 12.0s of video → 12.2s of wall
   clock. That is why onProgress exists and why the caller MUST show it —
   a silent two-minute wait is indistinguishable from a frozen app, and
   that misreading is the whole reason this feature was needed.
   ===================================================================== */

/* ⚠️ MP4 SPECIFICALLY, never WebM. lib/strip-video.js walks MP4/MOV box
   trees and does not understand Matroska, so a WebM here would be a file
   we publish without ever having cleaned it — the one failure the whole
   media pipeline exists to prevent. If a browser can't make MP4 we do
   not compress; we do not quietly switch container. */
const MIME = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';

/* Fit inside a 1080x1920 box, whichever way up the video is. More than
   this is invisible on the device it will be watched on. */
const SHORT_EDGE = 1080;
const LONG_EDGE  = 1920;

/* ⚠️ 2.2 Mbps, NOT the 2.8 first tried. MediaRecorder treats the bitrate
   as a suggestion — asking for 2.8 measured 3.25 coming out, which puts a
   two-minute clip exactly on the 50MB line. Asking for 2.2 leaves real
   headroom: ~3 minutes fits. Measure, then set, then measure again. */
const VIDEO_BPS = 2_200_000;
const AUDIO_BPS = 128_000;

/* Below this, leave it alone. A small clip re-encoded is a small clip
   made worse for no reason, plus a pointless wait. */
export const SHRINK_ABOVE_BYTES = 20 * 1024 * 1024;

export function canShrink() {
  try {
    return typeof MediaRecorder !== 'undefined'
      && typeof HTMLCanvasElement.prototype.captureStream === 'function'
      && MediaRecorder.isTypeSupported(MIME);
  } catch { return false; }
}

/* Returns a new File, or null meaning "use the original".
   ⭐ NULL IS ALWAYS SAFE. Every failure path returns null rather than
   throwing, because a video that uploads at full size and gets refused
   with an honest message beats a picker that explodes. */
export async function shrinkVideo(file, { onProgress } = {}) {
  if (!canShrink()) return null;

  const url = URL.createObjectURL(file);
  let v = null, audioCtx = null;

  const cleanup = () => {
    try { v && v.remove(); } catch {}
    try { audioCtx && audioCtx.close(); } catch {}
    URL.revokeObjectURL(url);
  };

  try {
    v = document.createElement('video');
    v.src = url;
    v.preload = 'auto';
    v.playsInline = true;
    /* ⚠️ NOT muted, and that is deliberate — see the audio note below.
       Kept effectively invisible rather than display:none, because a
       display:none video is allowed to stop decoding. */
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0.01';
    document.body.appendChild(v);

    await new Promise((ok, no) => {
      v.onloadedmetadata = ok;
      v.onerror = () => no(new Error('could not decode'));
      setTimeout(() => no(new Error('decode timed out')), 20000);
    });

    const sw = v.videoWidth, sh = v.videoHeight;
    if (!sw || !sh) throw new Error('no dimensions');

    /* Never upscale — a 480p clip stays 480p. */
    const scale = Math.min(1,
      SHORT_EDGE / Math.min(sw, sh),
      LONG_EDGE  / Math.max(sw, sh));
    /* Even numbers: H.264 chroma subsampling needs them, and an odd
       dimension is refused by some encoders outright. */
    const w = Math.max(2, Math.round(sw * scale / 2) * 2);
    const h = Math.max(2, Math.round(sh * scale / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });

    const stream = canvas.captureStream(30);

    /* -----------------------------------------------------------------
       🔴 THE AUDIO, AND THIS IS THE PART THAT SHIPS SILENT MUSIC VIDEOS
       IF IT IS GOT WRONG.

       The obvious build mutes the element so the member doesn't hear
       their own clip blasting for two minutes, then takes the track from
       v.captureStream(). In Chrome that hands back a track carrying
       SILENCE — the recording looks perfect, has an audio track, plays
       nothing. On a wall built for musicians that is the worst possible
       bug: it is invisible to us and obvious to the one person who cares.

       ⭐ So the audio is routed through an AudioContext to a stream
       destination and DELIBERATELY NOT connected to audioCtx.destination.
       createMediaElementSource takes the element's audio out of the
       speakers entirely, so the room stays quiet while the recorder gets
       the full signal.
       ----------------------------------------------------------------- */
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no AudioContext');
    audioCtx = new AC();
    if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} }
    const srcNode = audioCtx.createMediaElementSource(v);
    const dest = audioCtx.createMediaStreamDestination();
    srcNode.connect(dest);
    /* ⚠️ NO srcNode.connect(audioCtx.destination) — that line is what
       would make it audible. Its absence is the feature. */

    const aTracks = dest.stream.getAudioTracks();
    /* 🔴 A video with sound that comes back with no audio track means the
       routing failed. Refuse rather than publish a silent copy of
       somebody's song. */
    if (!aTracks.length) throw new Error('no audio track');
    aTracks.forEach((t) => stream.addTrack(t));

    const chunks = [];
    const rec = new MediaRecorder(stream, {
      mimeType: MIME,
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
    });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const draw = () => {
      if (v.paused || v.ended) return;
      ctx.drawImage(v, 0, 0, w, h);
      if (onProgress && v.duration) {
        onProgress(Math.min(0.99, v.currentTime / v.duration));
      }
      requestAnimationFrame(draw);
    };

    rec.start();
    /* 🔴 play() ON AN UNMUTED ELEMENT CAN BE REFUSED by autoplay policy if
       the user gesture has been lost across the awaits above. If that
       happens we abort — we do NOT retry muted, because muted is exactly
       the silent-video bug. */
    await v.play();
    draw();

    await new Promise((done) => { v.onended = done; });
    await new Promise((done) => { rec.onstop = done; rec.stop(); });

    const blob = new Blob(chunks, { type: 'video/mp4' });

    /* ⚠️ VERIFY THE BYTES, not the mime label we ourselves attached. A
       real MP4 carries 'ftyp' at offset 4. */
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isMp4 = String.fromCharCode(...head.slice(4, 8)) === 'ftyp';
    if (!isMp4 || blob.size < 1024) throw new Error('output not a usable mp4');

    /* If we made it bigger — a short, already-compressed clip — keep the
       original. Compressing something into a worse, larger file is the
       one outcome with no upside. */
    if (blob.size >= file.size) return null;

    onProgress && onProgress(1);
    const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '.mp4';
    return new File([blob], name, { type: 'video/mp4' });
  } catch {
    /* Swallowed on purpose — see the note on the return type. The caller
       falls back to the original file and the server still decides. */
    return null;
  } finally {
    cleanup();
  }
}
