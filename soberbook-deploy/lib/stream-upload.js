/* =====================================================================
   PUTTING A VIDEO ON CLOUDFLARE, FROM THE BROWSER.

   ⚠️ NO 'use client' DIRECTIVE, on purpose. Every export of a client
   module becomes a client REFERENCE, so a server component importing a
   named export out of one gets a proxy instead of a function — that took
   /wall down for every member on 2 Sept with a green build. A plain lib
   module can be imported from either side safely.

   ⚠️ Nothing in here is secret. The upload URL is minted server-side and
   is permission to PUT one file, once, to one place. The API token never
   leaves the server.
   ===================================================================== */

/* 🔴 THE HINT, NOT THE ANSWER — AND HERE THAT IS THE RIGHT WAY ROUND.

   Everywhere else in this app we refuse to guess a file's type from its
   name, because the browser lies (Android hands over
   `application/octet-stream` for perfectly good MP4s) and the SERVER can
   read the bytes. Here the server cannot: Cloudflare is the thing that
   reads the bytes, and it will refuse anything that is not video.

   ⭐ And the file this whole night was about — ProRes — is exactly the
   case where the browser CANNOT decode it, so probeVideo() correctly
   says "not a video" and we would otherwise never even offer to send it.
   So this list is deliberately WIDE. A false positive costs one polite
   refusal from Cloudflare. A false negative costs a member their
   finished work, which is what 10 Sept actually cost. */
const VIDEO_EXT = /\.(mp4|m4v|mov|qt|avi|mkv|webm|wmv|flv|mpg|mpeg|mts|m2ts|ts|3gp|mxf|dv|ogv|prores|dnxhd|braw|r3d)$/i;

export function looksLikeVideo(file) {
  if (!file) return false;
  if (/^video\//i.test(file.type || '')) return true;
  return VIDEO_EXT.test(file.name || '');
}

/* Is the Cloudflare road even open? Asks the server rather than guessing
   from a public env var, because the answer depends on a secret the
   browser must never see. Returns the upload door, or null. */
export async function streamDoor() {
  const r = await fetch('/api/video/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (r.status === 503) return null;          // not configured — fall back
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Couldn't start that upload.");
  return d;                                    // { uid, uploadURL }
}

/* ⚠️ XMLHttpRequest, not fetch, and that is not nostalgia — fetch still
   has no upload-progress event in any shipping browser. A 243MB file on a
   phone is minutes of silence otherwise, and silence is what makes
   somebody decide the app is broken and close it. */
export function putToStream(uploadURL, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    /* The field name is `file` and Cloudflare is strict about it. */
    form.append('file', file, file.name || 'video');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadURL, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(true);
      /* Cloudflare puts a readable reason in the body. Passing it through
         is the difference between "try the identical thing again" and
         knowing the file is not a video at all. */
      let why = '';
      try { why = (JSON.parse(xhr.responseText)?.errors || [])[0]?.message || ''; } catch {}
      reject(new Error(why || `upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('the connection dropped'));
    xhr.onabort  = () => reject(new Error('the upload was cancelled'));
    xhr.send(form);
  });
}

/* =====================================================================
   ☁️ THE BIG-FILE ROAD (tus), FOR ANYTHING OVER ~200MB.

   🔴 Cloudflare's basic POST is capped at 200MB and judges the size only
   AFTER receiving every byte — so an oversized file uploads to 100% and
   then comes back 413. Ty watched that happen twice before I read the
   right page. A progress bar that reaches the end and then fails reads as
   "the app broke", not as "there is a rule".

   ⭐ tus is also RESUMABLE, which is the bigger win on a phone: a dropped
   connection picks up from the last completed chunk instead of starting
   243MB over.

   ⚠️ THEIR CHUNK RULES ARE STRICT AND SILENT IF YOU BREAK THEM:
     · minimum 5,242,880 bytes
     · maximum 209,715,200 bytes
     · MUST be divisible by 256 KiB (262,144) — except the final chunk
   50MB is 52,428,800 = exactly 200 × 256 KiB, which is also the size they
   recommend for a reliable connection. Do not "tidy" this number.
   ===================================================================== */
const TUS_CHUNK = 52_428_800;          // 50MB — 200 × 256 KiB exactly

/* 🔴 THE THRESHOLD IS DELIBERATELY BELOW THEIR 200MB CEILING. A file at
   199MB would pass the cap and still be one enormous unresumable request
   on a phone. 150MB keeps real headroom and sends the genuinely big ones
   down the road built for them. Under this, the single POST is one round
   trip and is already proven. */
export const TUS_ABOVE_BYTES = 150 * 1024 * 1024;

export async function tusUpload(file, onProgress) {
  const r = await fetch('/api/video/tus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: file.size, name: file.name || 'video' }),
  });
  if (r.status === 503) return null;                 // not configured — fall back
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Couldn't start that upload.");

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK, file.size);
    const chunk = file.slice(offset, end);
    const base = offset;

    /* ⚠️ XHR again, not fetch — same reason as the small road: fetch still
       reports no upload progress in any shipping browser, and on a 243MB
       file that is minutes of a frozen-looking screen. Progress is the
       base offset plus however much of THIS chunk has gone. */
    const next = await new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PATCH', d.uploadURL, true);
      x.setRequestHeader('Tus-Resumable', '1.0.0');
      x.setRequestHeader('Upload-Offset', String(base));
      x.setRequestHeader('Content-Type', 'application/offset+octet-stream');
      x.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.min(1, (base + e.loaded) / file.size));
        }
      };
      x.onload = () => {
        if (x.status < 200 || x.status >= 300) {
          return reject(new Error(`chunk refused (${x.status})`));
        }
        /* 🔴 TRUST THE SERVER'S OFFSET, NEVER OUR OWN ARITHMETIC. tus
           lets the server accept a partial chunk, and if we assumed we
           were at `end` we would skip the missing bytes and hand
           Cloudflare a corrupt file that still "uploaded successfully".
           A wrong file that arrives is worse than an upload that fails. */
        const said = Number(x.getResponseHeader('Upload-Offset'));
        resolve(Number.isFinite(said) ? said : end);
      };
      x.onerror = () => reject(new Error('the connection dropped'));
      x.send(chunk);
    });

    /* ⚠️ A server that returns the SAME offset twice means no progress is
       being made; without this the loop spins forever on a stuck upload
       and the member watches a bar that never moves. */
    if (next <= offset) throw new Error('the upload stalled');
    offset = next;
  }

  return d.uid;
}

/* ⚠️ Transcoding is NOT instant and the member is standing there. We wait
   only long enough to be useful — past that the post can be made anyway
   and the player will say "still processing" on the first tap. Blocking
   the composer on a ten-minute encode would be a worse bug than the one
   this whole feature fixes. */
/* 🔴 IT ASKS /api/video/state, NOT /api/video/token, AND THAT DISTINCTION
   IS A BUG THAT WAS CAUGHT BEFORE IT SHIPPED.

   /token answers "may this person WATCH this?" by asking the four views.
   Right now — after the upload, before Post is pressed — no row anywhere
   carries this uid, so the correct answer is no, and this loop would have
   given up on the first try for every video ever uploaded. Both halves
   were right; the question was wrong. See the long note in
   app/api/video/state/route.js. */
export async function waitReady(uid, { ms = 90_000, onTick } = {}) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const r = await fetch('/api/video/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    if (d.ready) return true;
    onTick?.(d.state);
    await new Promise((s) => setTimeout(s, 3000));
  }
  /* ⚠️ Timing out is NOT a failure and must never be treated as one. The
     file is safely on Cloudflare and still encoding; the post goes up and
     the player says "still processing" on the first tap. Refusing the
     post here would throw away a finished upload to avoid a wait. */
  return false;
}
