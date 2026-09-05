'use client';

import { useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

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
    const file = e.target.files?.[0];
    /* ⚠️ Clear it immediately — otherwise picking the same file twice in
       a row fires no change event the second time, and the button
       silently dies after one use. */
    e.target.value = '';
    if (!file) return;

    setErr('');
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
      if (upErr) throw new Error('That upload didn’t finish. Try again.');

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
