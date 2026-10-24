'use client';

import { useState } from 'react';
import PhotoUpload from '../components/PhotoUpload';
import { browserClient } from '../../lib/supabase-browser';
import '../components/gallery.css';

/* =====================================================================
   YOUR PROFILE PHOTOS — add, take down, reorder. 23 Oct (0190).

   ⭐ IT SAVES AS YOU GO, AND THAT IS NOT A CONVENIENCE.

   Every other control on this screen collects changes and waits for a
   Save button, which is right for a name or a bio: nothing has happened
   yet and the member can change their mind for free. A photo is
   different. By the time it appears in this grid the FILE IS ALREADY IN
   STORAGE — PhotoUpload has uploaded it, finalize has stripped it and
   moved it into the bucket. If the array is not written at that moment,
   the member closes the page believing nothing happened while we are
   holding their picture with nothing pointing at it.

   So each add and each removal is written immediately, and there is no
   second button to forget.

   ⚠️ THE CAP IS IN THE DATABASE, NOT HERE. This file disables the button
   at ten because a disabled button is kinder than a refusal, but the
   check constraint on profiles.gallery is what actually enforces it. A
   limit that only exists in a React component is a limit anybody with a
   browser console does not have.
   ===================================================================== */

const MAX = 10;

export default function GalleryEdit({ initial = [], initialUrls = {} }) {
  const [paths, setPaths] = useState(Array.isArray(initial) ? initial : []);
  const [urls, setUrls]   = useState(initialUrls || {});
  const [err, setErr]     = useState('');
  const [busy, setBusy]   = useState(false);

  /* Write the whole array. ⚠️ Not an append — two tabs open on the same
     settings page would each append to their own stale copy and the
     second write would silently drop the first one's picture. Writing
     the array the member is actually looking at means the last write
     wins and matches what is on their screen. */
  async function save(next) {
    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Sign in first.'); return false; }

    const { error } = await supabase.from('profiles')
      .update({ gallery: next }).eq('id', user.id);
    if (error) {
      /* Say what the database said. A generic "couldn't save" sends
         somebody to try the identical thing again, which is the one
         action guaranteed not to help. */
      setErr(`That didn’t save — ${error.message}.`);
      return false;
    }
    setPaths(next);
    return true;
  }

  /* PhotoUpload hands back the stored path and a local preview url. We
     keep the preview so the picture appears straight away; on the next
     load the server signs a real one. */
  async function added(path, preview) {
    setErr('');
    if (!path) return;                      /* a video took the other road */
    if (paths.includes(path)) return;
    if (paths.length >= MAX) {
      setErr(`That’s ${MAX} — take one down before adding another.`);
      return;
    }
    setBusy(true);
    const next = [...paths, path];
    const ok = await save(next);
    if (ok && preview) setUrls((u) => ({ ...u, [path]: preview }));
    setBusy(false);
  }

  /* 🔴 THROUGH THE ROUTE, NOT A DIRECT ARRAY UPDATE. Dropping the path
     out of the array here would take the picture off the profile and
     leave the FILE in the bucket — reachable by anybody still holding a
     signed link, and paid for forever. /api/photo/delete removes the row
     and the file, in that order, and answers with what is left. */
  async function remove(path) {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/photo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'gallery', path }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'That didn’t come down.');
      setPaths(Array.isArray(d.gallery) ? d.gallery : paths.filter((p) => p !== path));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  /* ⚠️ Arrows, not drag-and-drop. A drag handle inside a 100px tile on a
     phone fights the page's own scroll, and the failure mode is a member
     who cannot scroll past their own photos. Two taps is slower and
     works on everything. */
  async function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= paths.length) return;
    const next = [...paths];
    [next[i], next[j]] = [next[j], next[i]];
    setErr('');
    setBusy(true);
    await save(next);
    setBusy(false);
  }

  return (
    <>
      <p className="hint">
        Up to ten pictures — you, your dog, the view out the window, whatever you
        want on there. They sit on your profile under a Photos tab, where anybody
        signed in can see them. Nothing goes on the wall and nobody gets a
        notification.
      </p>

      {paths.length > 0 && (
        <div className="gedit">
          {paths.map((p, i) => (
            <div className="gcell" key={p}>
              {/* ⚠️ An <img> with no src draws the browser's torn-page
                  glyph, which to somebody looking at their own photos
                  says "this one is gone". An empty box waits quietly.
                  Same argument as the `if (!url) return null` in Shot. */}
              {urls[p]
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={urls[p]} alt={`Photo ${i + 1}`} />
                : <span className="gblank" aria-hidden="true" />}
              <button type="button" className="gx" disabled={busy}
                      aria-label={`Take photo ${i + 1} down`}
                      onClick={() => remove(p)}>×</button>
              <span className="gmv">
                <button type="button" disabled={busy || i === 0}
                        aria-label={`Move photo ${i + 1} earlier`}
                        onClick={() => move(i, -1)}>‹</button>
                <button type="button" disabled={busy || i === paths.length - 1}
                        aria-label={`Move photo ${i + 1} later`}
                        onClick={() => move(i, 1)}>›</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grow">
        {/* ⚠️ allowStream is left OFF and accept stays images-only. A
            profile album is pictures; the video road hands back a null
            path and a Cloudflare uid, which this component would store
            as nothing. See the long note on the prop in PhotoUpload. */}
        <PhotoUpload
          kind="gallery"
          accept="image/*"
          label={paths.length >= MAX ? `That’s ${MAX} — take one down first` : 'Add a photo'}
          disabled={busy || paths.length >= MAX}
          onBusy={setBusy}
          onDone={added}
        />
        <span className="gcount">{paths.length} of {MAX}</span>
      </div>

      {err && <p className="gerr" role="alert">{err}</p>}

      <p className="hint">
        Adding or taking one down happens straight away — there is no second Save
        button here. Taking one down deletes the file itself, not just the link to
        it. Worth knowing before you put one up: anyone who can see it can
        screenshot it, here or anywhere else.
      </p>
      <p className="hint">
        If you switch yourself to anonymous further down this page, these come off
        your public profile the same moment your name, face and bio do. You still
        see them here.
      </p>
    </>
  );
}
