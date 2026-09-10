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

/* =====================================================================
   🔴 10 SEPT — THE BITRATE IS NO LONGER A CONSTANT, AND THAT WAS THE BUG.

   Ty tried to put out a record and the shrinker ran, showed a progress
   bar, and handed back the original 243MB file. Measured against the
   three videos that DID go up on 8-9 Sept — 41.1MB, 34.6MB, 34.7MB, all
   roughly two to two and a half minutes — the picture was obvious:

     at a fixed 2.2 Mbps, 3 minutes is the MOST that can ever fit under
     the 50MB ceiling. A four-minute record cannot be shrunk to fit, no
     matter how long it grinds, and it grinds in real time first.

   ⭐ That is the exact case the feature exists for. A musician putting
   out a track with a video is usually over three minutes. The shrinker
   worked for clips and failed for records — and records are the point.

   So the budget is fixed and the BITRATE IS DERIVED FROM THE DURATION,
   which is the way round it should always have been. A 6-minute video
   gets ~1 Mbps, a 10-minute one gets ~500k, and both land under the
   ceiling instead of failing after ten minutes of work.
   ===================================================================== */

/* 46MB, not 50. The ceiling is 50 and MediaRecorder's output is only ever
   approximate — spending the last 4MB on headroom costs nothing visible
   and is the difference between "fits" and "fits unless it doesn't". */
const BUDGET_BYTES = 46 * 1024 * 1024;

/* ⚠️ MEASURED, and it is why the old constant read 2.2 rather than 2.8:
   MediaRecorder treats the bitrate as a suggestion and OVERSHOOTS. Asking
   for 2.8 measured 3.25 coming out — a factor of about 1.16. So every
   figure below is computed in EFFECTIVE bits and divided by this before
   it is asked for. Getting this backwards is how a plan that says "this
   will fit" produces a file that doesn't. */
const OVERSHOOT = 1.2;

/* The floor. Below about 450k the picture stops being worth publishing —
   this is where we stop trying and say so instead. */
const MIN_VIDEO_BPS = 450_000;
/* And the ceiling: never spend MORE than the old constant on a short
   clip. A 40-second video does not need 4 Mbps. */
const MAX_VIDEO_BPS = 2_200_000;

/* 🔴 Audio is NOT scaled down as hard as video, on purpose. This is a
   wall for musicians — a soft picture is a compromise, a mangled song is
   a broken promise. 128k holds up; below 96k a mix starts to smear. */
const AUDIO_BPS_NORMAL = 128_000;
const AUDIO_BPS_LONG   = 96_000;

/* Fit inside a 1080x1920 box, whichever way up the video is. More than
   this is invisible on the device it will be watched on.
   ⚠️ Long videos step DOWN from here — see planFor(). At 500k, 720p looks
   considerably better than 1080p does, because the bits go to fewer
   pixels. Dropping resolution is the kinder half of dropping quality. */
const SHORT_EDGE = 1080;
const LONG_EDGE  = 1920;

/* Below this, leave it alone. A small clip re-encoded is a small clip
   made worse for no reason, plus a pointless wait. */
export const SHRINK_ABOVE_BYTES = 20 * 1024 * 1024;

/* How long a video can be and still fit, at the floor. Computed, not
   guessed, so the message the member reads is arithmetic rather than a
   number somebody typed once. */
export function maxSeconds() {
  return BUDGET_BYTES * 8 / (MIN_VIDEO_BPS + AUDIO_BPS_LONG);
}

/* The plan for a given duration: what to ask the recorder for, and
   whether it can work at all. Pure arithmetic — no browser, no file — so
   it can be reasoned about and tested on its own. */
export function planFor(seconds) {
  if (!(seconds > 0)) return { ok: false, reason: 'unknown length' };

  const audioBps = seconds > 360 ? AUDIO_BPS_LONG : AUDIO_BPS_NORMAL;
  const totalBps = BUDGET_BYTES * 8 / seconds;
  let videoBps = totalBps - audioBps;

  if (videoBps < MIN_VIDEO_BPS) {
    return {
      ok: false,
      reason: `it is ${Math.round(seconds / 60)} minutes long — the most that fits is about ${Math.floor(maxSeconds() / 60)}`,
    };
  }
  videoBps = Math.min(videoBps, MAX_VIDEO_BPS);

  /* Resolution follows the bitrate, not the clock. Under ~900k, 1080p is
     spending pixels it cannot afford to describe. */
  const longEdge = videoBps >= 1_500_000 ? 1920
                 : videoBps >=   900_000 ? 1280
                 : 960;
  const shortEdge = Math.round(longEdge * SHORT_EDGE / LONG_EDGE);

  return {
    ok: true,
    /* what we ASK for — deflated by the measured overshoot */
    askVideoBps: Math.round(videoBps / OVERSHOOT),
    askAudioBps: audioBps,
    /* what we EXPECT to come out, for the assertion after */
    expectBytes: Math.round((videoBps + audioBps) * seconds / 8),
    longEdge, shortEdge,
  };
}

/* ⭐ ASK THE BROWSER WHETHER IT IS A VIDEO, DO NOT GUESS FROM THE NAME.

   🔴 The caller used to decide with
       /^video\//.test(file.type) || /\.(mov|mp4|m4v)$/i.test(file.name)
   and that is the second half of tonight's bug. finalize/route.js has
   carried a note for weeks saying Android hands over
   `application/octet-stream` for perfectly good MP4s — so the MIME
   cannot be trusted, and the three-extension fallback misses .mkv, .avi,
   .webm and anything an editor names oddly. A file that misses BOTH
   tests skips the shrinker entirely and walks into the size wall at full
   size, which looks exactly like the shrinker doing nothing.

   Loading it into a video element and asking for its dimensions is the
   authoritative answer, costs a fraction of a second, and tells us the
   duration we now need anyway. */
export async function probeVideo(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.muted = true;              /* metadata only — nothing is played here */
  v.src = url;
  try {
    await new Promise((ok, no) => {
      v.onloadedmetadata = ok;
      v.onerror = () => no(new Error('this browser cannot read that file'));
      setTimeout(() => no(new Error('took too long to read')), 15000);
    });
    if (!v.videoWidth || !v.videoHeight) {
      return { isVideo: false, reason: 'no picture in it' };
    }
    return {
      isVideo: true,
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
    };
  } catch (e) {
    return { isVideo: false, reason: e.message };
  } finally {
    try { v.remove(); } catch {}
    URL.revokeObjectURL(url);
  }
}

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
export async function shrinkVideo(file, { onProgress, onReason, plan } = {}) {
  /* 🔴 EVERY DECLINE NOW SAYS WHY. It still returns null — null is still
     always safe and the caller still falls back — but a silent null is
     what made tonight take an hour. The member watched a progress bar,
     got told their file was still 243MB, and had no way to tell whether
     the shrinker had crashed, given up, or never run at all. A reason
     costs one callback and is the difference between a wall and a fact. */
  const decline = (why) => { try { onReason && onReason(why); } catch {} return null; };

  if (!canShrink()) return decline('this browser cannot compress video');
  if (plan && !plan.ok) return decline(plan.reason);

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
    /* ⚠️ The BOX comes from the plan now, not from the constants. A long
       video is fitted into a smaller box because its bitrate cannot
       describe a bigger one — see planFor(). Falls back to the full box
       when no plan was passed, so this stays safe to call bare. */
    const boxLong  = plan?.longEdge  || LONG_EDGE;
    const boxShort = plan?.shortEdge || SHORT_EDGE;
    const scale = Math.min(1,
      boxShort / Math.min(sw, sh),
      boxLong  / Math.max(sw, sh));
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
      videoBitsPerSecond: plan?.askVideoBps || MAX_VIDEO_BPS,
      audioBitsPerSecond: plan?.askAudioBps || AUDIO_BPS_NORMAL,
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
    if (blob.size >= file.size) return decline('compressing it made it bigger');

    /* 🔴 CHECK THE PLAN AGAINST REALITY. planFor() is arithmetic and
       MediaRecorder is a suggestion box — if the output still will not
       clear the ceiling, say so HERE with the real number, rather than
       handing back a 68MB file for the size check to refuse with a
       message that sounds like nothing happened. */
    if (blob.size > 50 * 1024 * 1024) {
      return decline(
        `it came out ${(blob.size / 1048576).toFixed(0)}MB, still over the 50MB limit`
      );
    }

    onProgress && onProgress(1);
    const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '.mp4';
    return new File([blob], name, { type: 'video/mp4' });
  } catch (e) {
    /* Still returns null — the caller still falls back and the server is
       still the authority. But the REASON now travels. Swallowing it
       whole is what made a decode failure and a browser limitation and a
       file that was never a video look identical from the outside. */
    return decline(e && e.message ? e.message : 'it could not be compressed');
  } finally {
    cleanup();
  }
}
