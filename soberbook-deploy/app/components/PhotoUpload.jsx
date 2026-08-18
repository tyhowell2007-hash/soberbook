'use client';

import { useRef, useState } from 'react';

/* =====================================================================
   PICK A PHOTO — the one control both the profile and the composer use.

   Deliberately small. All of the safety lives on the server (see
   app/api/photo/upload/route.js); this is only the part a thumb touches.

   ---------------------------------------------------------------------
   WHY THE PREVIEW USES THE LOCAL FILE AND NOT THE UPLOADED ONE

   After uploading we have a storage path, and the honest thing would be
   to fetch a signed URL and show what actually landed. That is one more
   round trip while somebody sits looking at a spinner.

   So the preview is drawn straight from the file on the phone with
   createObjectURL — instant, no network. ⚠️ Which means the preview is
   the ORIGINAL, and what got stored is the re-encoded copy: rotated
   upright, shrunk, stripped of its location. They look the same. On a
   sideways-stored photo they briefly won't, and the stored one is the
   right one.

   ⚠️ revokeObjectURL matters. An object URL pins the whole file in
   memory until it is released. Pick six photos on an old phone without
   releasing them and the tab dies — a leak that only ever shows up on
   the cheapest device, which in this app is not an edge case.
   ===================================================================== */

export default function PhotoUpload({
  kind,                 // 'post' | 'avatar'
  onDone,               // (path) => void
  label = 'Add a photo',
  className = 'btn ghost',
  disabled = false,
}) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  async function chosen(e) {
    const file = e.target.files?.[0];
    /* ⚠️ Clear the input immediately. Without this, picking the same file
       twice in a row fires no change event the second time — the classic
       "it worked once and then the button died" bug. */
    e.target.value = '';
    if (!file) return;

    setErr('');
    setBusy(true);

    const preview = URL.createObjectURL(file);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);

      const res  = await fetch('/api/photo/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "That photo couldn't be saved.");
      onDone(data.path, preview);
    } catch (e2) {
      URL.revokeObjectURL(preview);
      /* Shown, not alerted. An alert() on a phone covers the screen and
         has to be dismissed before you can see what you were doing. */
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled || busy}
              onClick={() => input.current?.click()}>
        {busy ? 'Working…' : label}
      </button>

      {/* accept is a hint to the picker, never a check — the real one is
          in the upload route, which decodes the file and rejects anything
          that isn't an image. A file dialog filter stops honest mistakes
          and nothing else. */}
      <input ref={input} type="file" accept="image/*" hidden
             onChange={chosen} tabIndex={-1} aria-hidden="true" />

      {err && <p className="phserr" role="alert">{err}</p>}
    </>
  );
}
