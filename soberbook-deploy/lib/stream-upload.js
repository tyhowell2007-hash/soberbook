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
