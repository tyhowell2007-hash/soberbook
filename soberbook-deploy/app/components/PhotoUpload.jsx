'use client';

import { useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
/* ⚠️ NAMED imports out of a plain lib module — shrink-video.js carries no
   'use client' directive on purpose, so this file's server-rendered
   siblings could import it too without the 5 Sept named-export trap. */
import { canShrink, shrinkVideo, SHRINK_ABOVE_BYTES } from '../../lib/shrink-video';

/* =====================================================================
   PICK A PHOTO — now in three steps instead of one.

   It used to POST the file to our own API route. That broke at 4.5MB
   because Vercel refuses request bodies bigger than that, before our
   code runs. Phone photos are routinely bigger. Now:

     1 · ask our server for a signed upload URL   (tiny JSON)
     2 · PUT the file straight to Supabase        (no Vercel in the way)
     3 · ask our server to strip and promote it   (tiny JSON)

   ⚠️ The file never passes through Vercel, which is the entire point —
   and the safety story is unchanged, because step 2 lands in a bucket
   nothing is ever served from. Nobody can see the photo, including the
   person who just uploaded it, until step 3 has stripped it.
   ===================================================================== */

export default function PhotoUpload({
  kind,                 // 'post' | 'avatar'
  onDone,               // (path, previewUrl, isVideo) => void
  label = 'Add a photo',
  className = 'btn ghost',
  disabled = false,
  onBusy,               // (bool) => void — lets the parent lock its Post button
  accept = 'image/*',   // photos only unless the caller says otherwise
  /* ⚠️ For callers whose button is a fixed-size icon. The default shows
     the live stage — "Uploading…" — which is genuinely useful on a slow
     phone and completely wrong inside a 44px circle, where it overflows
     and shoves the message box off the row. The Front Room passes "…"
     here and prints the progress line somewhere it fits. */
  busyLabel,
}) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  /* Which of the three steps we're on, so a big photo on a slow phone
     doesn't look frozen. A 12MB upload takes real seconds. */
  const [stage, setStage] = useState('');

  async function chosen(e) {
    let file = e.target.files?.[0];
    /* ⚠️ Clear it immediately — otherwise picking the same file twice in
       a row fires no change event the second time, and the button
       silently dies after one use. */
    e.target.value = '';
    if (!file) return;

    setErr('');

    /* ---- shrink a phone video before anything else ------------------
       🔴 A two-minute iPhone 4K clip is 412MB. Without this the 50MB
       ceiling means members get about fourteen seconds, and they don't
       report that — they conclude the app is broken. See lib/shrink-video.js.

       ⚠️ Deliberately BEFORE the size check below, so the check measures
       what we are actually about to upload rather than what was picked.
       Getting that order wrong would refuse a file we were about to make
       perfectly acceptable. */
    const looksVideo = /^video\//.test(file.type || '')
      || /\.(mov|mp4|m4v)$/i.test(file.name || '');
    if (looksVideo && file.size > SHRINK_ABOVE_BYTES && canShrink()) {
      setBusy(true);
      onBusy?.(true);
      setStage('Shrinking… 0%');
      /* ⚠️ Real time — two minutes of video takes two minutes. The
         percentage is not decoration, it is the difference between
         "working" and "frozen". */
      const smaller = await shrinkVideo(file, {
        onProgress: (p) => setStage(`Shrinking… ${Math.round(p * 100)}%`),
      });
      /* null means it declined — unsupported browser, decode failure, or
         it would have come out bigger. The original carries on to the
         size check, which will refuse it honestly if it must. */
      if (smaller) file = smaller;
      setStage('');
    }

    /* ---- refuse it here, before the upload, not after ---------------
       🔴 Ty, 8 Sept: "I'm trying to upload a video, and it's not working."
       There was NO size check on this side at all. So an oversized file
       was carried all the way to Supabase — minutes, on a phone — and
       only then refused. The wait made it feel like a broken app rather
       than a file that was never going to be accepted.

       ⚠️ 50MB is finalize's MAX_VIDEO_BYTES, the LARGER of the two server
       ceilings, and that is deliberate. The browser cannot reliably tell
       a photo from a video — Android hands over `application/octet-stream`
       for perfectly good MP4s, which is why the note further down says the
       server decides by reading the bytes. Checking against the tighter
       25MB photo limit here would refuse large videos that are genuinely
       fine. ⭐ So this check only ever catches what BOTH limits would
       reject; finalize stays the authority, exactly as it is for type. */
    const MAX_CLIENT_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_CLIENT_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(0);
      /* Says the real number and what to do instead. "Too big" on its own
         leaves somebody trimming a video by guesswork. */
      setErr(
        `That file is ${mb}MB — the limit is 50MB. ` +
        `For something longer, put it up on YouTube and paste the link instead.`
      );
      /* 🔴 RELEASE THE BUTTON. Ty, 10 Sept: "I'm trying to put up a record,
         and it won't let me do it again." He was right and it was ours.

         The shrink branch above sets busy BEFORE this check runs (correctly
         — the check has to measure the shrunk file, not the picked one).
         This early return then skipped the cleanup, because the only
         setBusy(false) in the whole function lives in the `finally` of a
         try block that starts BELOW here. So the button sat on "Working…",
         disabled, forever, and onBusy left the parent's own button locked
         with it. The only way out was a page reload.

         ⭐ It could only ever hit somebody uploading a BIG VIDEO — which is
         precisely the person the shrink was added for. A small file never
         sets busy, so the same return was harmless, which is how this
         survived the 8 Sept session that wrote the check and the one that
         added the shrink.

         ⚠️ A `return` between an acquire and its release is the bug, not
         the missing line. If a third early exit is ever added here, it
         needs these two lines too — or move the whole body inside the try
         so `finally` owns the release for every path out. */
      setBusy(false);
      onBusy?.(false);
      setStage('');
      return;
    }

    setBusy(true);
    onBusy?.(true);

    const preview = URL.createObjectURL(file);
    try {
      /* --- 1 · a door, not a key -------------------------------------
         The server picks the path. We only get permission to PUT one
         file, once, where it says. */
      setStage('Getting ready…');
      const r1 = await fetch('/api/photo/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, contentType: file.type }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error || "Couldn't start that upload.");

      /* --- 2 · straight to storage ----------------------------------
         ⚠️ This is the step that used to hit Vercel's wall. It doesn't
         touch our server at all now. */
      setStage('Uploading…');
      const { error: upErr } = await browserClient()
        .storage.from('quarantine')
        .uploadToSignedUrl(d1.path, d1.token, file);
      /* 🔴 THIS LINE USED TO DISCARD `upErr` AND SUBSTITUTE "That upload
         didn't finish. Try again." — and that is why a whole session went
         into GUESSING what was wrong with Ty's video on 8 Sept.

         ⭐ Supabase says exactly what happened here: wrong mime type for
         the bucket, over the bucket's size limit, expired token, network.
         Every one of those needs a different response from the person
         holding the phone, and we were flattening all of them into one
         sentence that means "try the identical thing again" — which is
         the one action guaranteed not to help.

         ⚠️ The generic line is KEPT as a fallback, because upErr.message
         can be empty on a bare network drop, and a blank error is worse
         than a vague one. */
      if (upErr) {
        const why = (upErr.message || '').trim();
        /* mime is the likeliest real cause and the least guessable: the
           quarantine bucket has an allow-list, and a phone can hand over
           a type that is not on it — at which point nothing about the
           file being "too big" or the network is true. */
        const mime = /mime|content.?type/i.test(why)
          ? ` Sober Book can't take a ${file.type || 'file of that type'} yet.`
          : '';
        throw new Error(
          (why ? `That upload didn’t finish — ${why}.` : 'That upload didn’t finish.') + mime
        );
      }

      /* --- 3 · strip and promote ------------------------------------ */
      setStage('Finishing…');
      const r2 = await fetch('/api/photo/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, path: d1.path }),
      });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok) throw new Error(d2.error || "That photo couldn't be saved.");

      /* ⚠️ `d2.isVideo`, from the SERVER — not `file.type` from the
         browser. The server decided by reading the file's actual first
         bytes; the browser's Content-Type is a guess from the filename
         and is wrong often enough to matter (Android hands over
         `application/octet-stream` for perfectly good MP4s). Whoever
         looked at the bytes is the one who knows. */
      onDone(d2.path, preview, !!d2.isVideo);
    } catch (e2) {
      URL.revokeObjectURL(preview);
      /* Shown next to the control, never an alert() — on a phone an alert
         covers the screen and has to be dismissed before you can see what
         you were doing. */
      setErr(e2.message);
    } finally {
      setBusy(false);
      setStage('');
      onBusy?.(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled || busy}
              onClick={() => input.current?.click()}>
        {busy ? (busyLabel || stage || 'Working…') : label}
      </button>

      {/* accept is a hint to the picker, never a check — the real one is
          in finalize, which decodes the actual bytes. A file dialog
          filter stops honest mistakes and nothing else. */}
      <input ref={input} type="file" accept={accept} hidden
             onChange={chosen} tabIndex={-1} aria-hidden="true" />

      {err && <p className="phserr" role="alert">{err}</p>}
    </>
  );
}
