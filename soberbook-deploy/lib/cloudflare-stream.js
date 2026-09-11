/* =====================================================================
   CLOUDFLARE STREAM — upload anything, play it back signed.

   🔴 WHY THIS EXISTS. 10 Sept, Ty spent four hours unable to put up a
   34-second trailer. The file was ProRes LT: 56 Mbps of video and
   uncompressed audio, 243MB for half a minute. NO BROWSER DECODES
   PRORES — not Chrome, not Safari, not a phone — so lib/shrink-video.js,
   which runs in the browser, could never have helped. It probed the file,
   got "not a video", and stood aside. That is physics, not a bug.

   Ty: "A lot of content creators are gonna use that format. We're gonna
   have to adapt and be able to accept those in any other kind of form of
   video that people give us. We are Soberbook. We do not fail."

   So: the file goes straight to Cloudflare, they transcode anything
   ffmpeg understands, and they bill by DURATION not file size — a 243MB
   ProRes clip costs exactly what an 11MB mp4 of the same length costs.
   Ingress and encoding are free.

   ⚠️ SERVER ONLY. CF_STREAM_TOKEN can upload, delete and read every
   video on the account. It is never sent to a browser, and nothing in
   this file may be imported from a 'use client' module.
   ===================================================================== */

const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN   = process.env.CF_STREAM_TOKEN;
const API     = 'https://api.cloudflare.com/client/v4';

/* ⚠️ Degrade to "not configured" rather than throwing on import. The 5
   Sept lesson from sign-photos.js: a missing key must not be able to 500
   a whole page. Callers check this and say something honest instead. */
export function streamReady() {
  return Boolean(ACCOUNT && TOKEN);
}

async function cf(path, init = {}) {
  const r = await fetch(`${API}/accounts/${ACCOUNT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    /* ⚠️ Cloudflare puts the useful part in errors[].message. Throwing the
       status alone gives "500" to a member who needs to know whether to
       try again or change the file. */
    const why = j?.errors?.[0]?.message || `HTTP ${r.status}`;
    throw new Error(why);
  }
  return j.result;
}

/* ---------------------------------------------------------------------
   ONE-TIME UPLOAD URL — the same shape as the Supabase signed upload we
   already use: the SERVER decides where the file may go, the browser
   only gets permission to put one file, once.

   🔴 requireSignedURLs IS SET HERE AND IS NOT OPTIONAL. Cloudflare's own
   words: "By default, videos on Stream can be viewed by anyone with just
   a video id." On a recovery app that is unthinkable — a video id in a
   log or a screenshot would be a permanent public link to somebody's
   face and voice. Setting it at creation means there is never a window,
   however short, where the video is public.

   ⚠️ allowedOrigins is a SECOND lock, not a replacement. It stops a
   signed URL being usable if it is lifted and embedded on another site.
   --------------------------------------------------------------------- */
export async function directUploadUrl({ maxDurationSeconds = 720, creator } = {}) {
  const r = await cf('/stream/direct_upload', {
    method: 'POST',
    body: JSON.stringify({
      maxDurationSeconds,
      requireSignedURLs: true,
      allowedOrigins: ['soberbook.app'],
      /* ⭐ WHO UPLOADED IT, so the "is it encoded yet?" question can be
         answered before the video belongs to any post. Between the upload
         finishing and the member pressing Post, NO view carries this uid —
         so the normal permission check (ask the views) correctly says no,
         and the composer would sit on "Processing…" forever waiting for an
         answer that can never come. This is the only thing that can vouch
         for the file in that window.
         ⚠️ It is our own member id and it stays on Cloudflare's side; it is
         never returned to a browser. */
      meta: creator ? { creator } : undefined,
      /* The link itself is short-lived. A creator upload link that sits
         around for a day is a day of reserved storage and a day of
         somebody else being able to use it. */
      expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
  });
  return { uid: r.uid, uploadURL: r.uploadURL };
}

/* Has it finished transcoding? A just-uploaded video is not playable for
   a few seconds to a few minutes depending on length. */
export async function videoState(uid) {
  const r = await cf(`/stream/${uid}`);
  return {
    ready: r?.readyToStream === true,
    state: r?.status?.state || 'unknown',
    /* ⚠️ Duration is what we are BILLED on, so it is worth having. */
    duration: r?.duration ?? null,
    /* Who uploaded it — see directUploadUrl. The ONLY thing that can
       vouch for a video in the window before it belongs to a post. */
    creator: r?.meta?.creator || null,
  };
}

/* 🔴 DELETING IS OUR OBLIGATION AND NOTHING ELSE WILL DO IT.
   referenced_media() and the orphan sweeper only know about paths in our
   own buckets. A stream_uid is not a path, so a deleted post leaves a
   Cloudflare video behind forever — paying storage on something nobody
   can reach. 0063 taught this for buckets; it is the same lesson arriving
   from a direction the sweeper cannot see. */
export async function deleteVideo(uid) {
  await cf(`/stream/${uid}`, { method: 'DELETE' });
}

/* ---------------------------------------------------------------------
   THE PLAYBACK HOST.

   Every account gets its own `customer-<CODE>.cloudflarestream.com`, and
   the code is not something we can guess — it comes back inside the
   video's own playback URLs. So we read it off a real video once and keep
   it. ⚠️ Module-level memory on Vercel dies between requests, which is
   exactly the trap sign-photos.js fell into on 26 Aug — but here it is a
   pure optimisation with no correctness claim attached: worst case we do
   one extra API call. CF_STREAM_HOST short-circuits it entirely once Ty
   has the value.
   --------------------------------------------------------------------- */
let cachedHost = null;

export async function playbackHost(uid) {
  if (process.env.CF_STREAM_HOST) return process.env.CF_STREAM_HOST;
  if (cachedHost) return cachedHost;
  const r = await cf(`/stream/${uid}`);
  const hls = r?.playback?.hls || '';
  const m = hls.match(/^https:\/\/([^/]+)\//);
  if (!m) throw new Error('could not read the playback host');
  cachedHost = m[1];
  return cachedHost;
}

/* ---------------------------------------------------------------------
   A SIGNED PLAYBACK TOKEN.

   🔴 THIS USES CLOUDFLARE'S /token ENDPOINT (their "Option 1"), NOT a
   local signing key, AND THAT IS A DELIBERATE TRADE.

   Option 3 — signing locally with an RSA key — is not rate limited and is
   the right answer at scale. It also needs a SECOND secret created and
   pasted by hand. Tonight the whole feature is blocked on Ty doing
   exactly one credential step, and every extra step is a way for this not
   to get finished. /token needs nothing but the API token that has to
   exist anyway.

   ⚠️ Cloudflare's own guidance: /token is for under ~1,000 tokens a day.
   Sober Book has 208 members and one token is minted per TAP on a video,
   not per page load, so that ceiling is a long way off.

   🔴 THE UPGRADE PATH, written down so it is not rediscovered: when the
   app outgrows this, create a signing key ONCE
     POST /accounts/{id}/stream/keys
   store `id` and the base64 `jwk`, and sign
     header  {alg:'RS256', kid}
     payload {sub: uid, kid, exp}
   with RSASSA-PKCS1-v1_5 / SHA-256. The rest of this file does not change
   — only this function does.

   ⚠️ exp cannot be more than 24 hours out; Cloudflare refuses the token
   outright if it is. One hour matches the TTL the photo signer already
   uses, so every kind of media in the app behaves the same way.

   🔴 Deliberately NOT downloadable. A member watching somebody's song is
   a different thing from a member keeping a copy of it, and this wall is
   full of people's work.
   --------------------------------------------------------------------- */
export async function playbackToken(uid, { seconds = 3600 } = {}) {
  const r = await cf(`/stream/${uid}/token`, {
    method: 'POST',
    body: JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + Math.min(seconds, 24 * 3600),
    }),
  });
  if (!r?.token) throw new Error('no playback token came back');
  return r.token;
}

/* The player URL, with the TOKEN standing in for the video id — that
   substitution is the whole signed-URL mechanism, straight out of
   Cloudflare's docs. A bare uid in this position returns 401 once
   requireSignedURLs is on, which is the proof the lock is working. */
export async function playerUrl(uid, opts) {
  const [host, token] = await Promise.all([playbackHost(uid), playbackToken(uid, opts)]);
  return `https://${host}/${token}/iframe`;
}
