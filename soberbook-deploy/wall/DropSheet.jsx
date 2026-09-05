'use client';

import { useEffect, useState } from 'react';
import PhotoUpload from '../components/PhotoUpload';

/* =====================================================================
   PUTTING OUT A RECORD.

   Ty: "now how do artists get to that? and set it up the way they want
   to." Then, on placement: "put it in post, but as a second option."

   ⭐ IT COLLECTS, IT DOES NOT POST. This sheet hands a config back to the
   composer, which creates the post and the drop row together. Keeping the
   writing in one place means a drop goes through exactly the same insert
   path as every other post — anonymity, audience, rate limits and all —
   instead of a second code path that would eventually disagree with the
   first.

   ---------------------------------------------------------------------
   ⭐ WHY IT'S BLACK AND ACID WHEN THE REST OF THE APP IS GREEN.

   It's the same language as the poster it produces. You're looking at
   what you're making while you make it. A cream form that outputs a gig
   poster feels like filling in a tax return to get a tattoo.

   ---------------------------------------------------------------------
   🔴 THE SIGNATURE IS THE ONLY FIELD THAT LOOKS LIKE IT MATTERS.

   Everything else is grey; this one has an acid border. A checkbox gets
   skimmed — typing your own name is a signature and it feels like one.

   `owns_it_at` is NOT NULL in the database, so a drop cannot exist
   without a claim no matter what the interface does. This is the other
   half: making the moment feel like the thing it is, rather than burying
   it in fine print. The rule is enforced in the database and MEANT in the
   interface.

   ⚠️ It compares case-insensitively and ignores spacing, because
   demanding an exact match on somebody's own name is a puzzle, not a
   safeguard — and the person it would lock out is the one being careful.
   ===================================================================== */

const WINDOWS = [
  { h: null, label: 'no window' },
  { h: 12,   label: '12 hours' },
  { h: 24,   label: '24 hours' },
  { h: 168,  label: 'a week' },
];

/* datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. ⚠️ toISOString()
   returns UTC, so using it here shows somebody in Ohio a time four hours
   off their own clock — and they'd schedule their release to it. */
function localValue(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
       + `T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const tidy = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export default function DropSheet({ defaultArtist = '', onClose, onDone }) {
  /* ⚠️ defaultArtist may be empty — plenty of members never set a display
     name. The caller falls back to the handle rather than leaving this
     blank, because an empty "Credited to" on the sheet that produces a
     poster with somebody's name on it reads as broken. */
  const [artist, setArtist] = useState(defaultArtist);
  const [title, setTitle]   = useState('');
  const [source, setSource] = useState('file');      // 'file' | 'link'
  const [media, setMedia]   = useState(null);        // { path, kind }
  const [art, setArt]       = useState(null);        // { path, preview }
  const [link, setLink]     = useState('');
  const [outYet, setOutYet] = useState('no');        // 'yes' | 'no'
  const [when, setWhen]     = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return localValue(d);
  });
  const [win, setWin]   = useState(12);
  const [sign, setSign] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const signed = artist.trim().length > 0 && tidy(sign) === tidy(artist);
  const hasSomething = source === 'file' ? !!media : link.trim().length > 8;
  const ready = artist.trim() && title.trim() && hasSomething && signed && !busy;

  function submit(e) {
    e.preventDefault();
    if (!ready) return;
    /* ⚠️ `kind` comes from what finalize said the FILE was, not from a
       toggle the person set. Somebody picking their music video and
       leaving a radio button on "audio" would otherwise get a drop the
       card renders with an <audio> tag over a video file. */
    const kind = source === 'file' ? (media.kind || 'audio')
                                   : (/youtu|vimeo/.test(link) ? 'video' : 'audio');
    onDone({
      artist: artist.trim(),
      title: title.trim(),
      kind,
      media_path: source === 'file' ? media.path : null,
      external_url: source === 'link' ? link.trim() : null,
      art_path: art?.path || null,
      /* Already out → it opens now. ⚠️ And no window, because there is no
         exclusive to claim on something the world already has — that was
         the bug Ty caught on the very first card. */
      release_at: outYet === 'yes' ? new Date().toISOString()
                                   : new Date(when).toISOString(),
      exclusive_hours: outYet === 'yes' ? null : win,
    });
  }

  return (
    <div className="sheetwrap" role="dialog" aria-modal="true" aria-label="Put out a record">
      <button className="scrim" onClick={onClose} aria-label="Close" />

      <form className="ds" onSubmit={submit}>
        <div className="ds-top">
          <span className="ds-kick">Put out a record</span>
          <button type="button" className="ds-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ds-body">
          <label className="ds-lab" htmlFor="ds-artist">Credited to</label>
          {/* ⚠️ Defaults to their display name but stays editable. A stage
              name usually isn't the name on the account, and getting that
              wrong on somebody's record is worse than asking. */}
          <input id="ds-artist" className="ds-in" value={artist} maxLength={60}
                 onChange={(e) => setArtist(e.target.value)} placeholder="Your name, as you want it" />

          <label className="ds-lab" htmlFor="ds-title">Title</label>
          <input id="ds-title" className="ds-in" value={title} maxLength={120}
                 onChange={(e) => setTitle(e.target.value)} placeholder="What's it called?" />

          <div className="ds-lab">The record</div>
          <div className="ds-seg">
            <button type="button" className={source === 'file' ? 'on' : ''}
                    onClick={() => setSource('file')}>A file</button>
            <button type="button" className={source === 'link' ? 'on' : ''}
                    onClick={() => setSource('link')}>A link</button>
          </div>

          {source === 'file' ? (
            <div className="ds-file">
            {/* 🔴 `.aiff` WAS LISTED HERE AND THE SERVER REJECTS IT — 3 Sept.
                Listing a format by name is a promise. finalize sniffs for
                MP3 (ID3 or frame sync), RIFF/WAV and the MP4 box tree, and
                refuses everything else, so an artist could pick an AIFF,
                watch it upload, and be turned away at the end. Same shape
                as any other claim the app can't keep.

                ⚠️ `audio/*` STAYS on purpose. It keeps the picker
                permissive — somebody with a FLAC can still try — and the
                refusal names the way out: "MP3, WAV, M4A, MP4 or MOV."
                A clear no beats a greyed-out file you can't even select.
                🔴 Supporting AIFF means writing a fourth stripper. It is
                an IFF chunk tree like WAV, so lib/strip-wav.js is the
                shape to copy — allowlist COMM and SSND, drop NAME/AUTH/
                ANNO/ID3. That is a session with real tests, not a line. */}
              <PhotoUpload kind="drop" className="ds-pick" disabled={busy}
                           /* ⚠️ EXTENSIONS AS WELL AS MIME TYPES. macOS does
                              not reliably match `audio/*` to a .m4a in the
                              file dialog — the file shows up greyed out and
                              unselectable, which reads as "the app won't take
                              my song". Listing the extensions costs nothing
                              and removes the whole class of picker weirdness.
                              ⚠️ Still only a hint: finalize reads the bytes. */
                           accept="audio/*,.m4a,.mp3,.wav,.aac,video/mp4,video/quicktime,.mov,.mp4"
                           label={media ? '✓ ready' : 'Choose audio or video'}
                           onBusy={setBusy}
                           onDone={(path, _preview, isVideo) => {
                             setMedia({ path, kind: isVideo ? 'video' : 'audio' });
                             setErr('');
                           }} />
              {media && <span className="ds-note">{media.kind} · cleaned and stored</span>}
            </div>
          ) : (
            <input className="ds-in" value={link} onChange={(e) => setLink(e.target.value)}
                   placeholder="https://open.spotify.com/…" inputMode="url" />
          )}

          <div className="ds-lab">Cover (optional)</div>
          <div className="ds-file">
            <PhotoUpload kind="dropart" className="ds-pick" disabled={busy}
                         accept="image/*" label={art ? '✓ set' : 'Choose a picture'}
                         onBusy={setBusy}
                         onDone={(path, preview) => setArt({ path, preview })} />
            {art?.preview && /* eslint-disable-next-line @next/next/no-img-element */
              <img className="ds-art" src={art.preview} alt="" />}
          </div>

          <div className="ds-rule" />

          <div className="ds-lab">Is it out yet?</div>
          <div className="ds-seg">
            <button type="button" className={outYet === 'yes' ? 'on' : ''}
                    onClick={() => setOutYet('yes')}>Already out</button>
            <button type="button" className={outYet === 'no' ? 'on' : ''}
                    onClick={() => setOutYet('no')}>Not yet</button>
          </div>

          {/* ⭐ The whole schedule disappears for something already public.
              An artist sharing an old track shouldn't wade through
              countdown settings they don't need. */}
          {outYet === 'no' && (
            <div className="ds-two">
              <div>
                <label className="ds-lab" htmlFor="ds-when">Opens</label>
                <input id="ds-when" className="ds-in" type="datetime-local"
                       value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div>
                <label className="ds-lab" htmlFor="ds-win">Only here for</label>
                <select id="ds-win" className="ds-in" value={String(win)}
                        onChange={(e) => setWin(e.target.value === 'null' ? null : Number(e.target.value))}>
                  {WINDOWS.map((w) =>
                    <option key={String(w.h)} value={String(w.h)}>{w.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="ds-sign">
            <p className="ds-claim">This is my work, and I have the right to put it out.</p>
            <label className="ds-lab" htmlFor="ds-sig">Sign with your name</label>
            <input id="ds-sig" className="ds-in ds-siginput" value={sign} maxLength={60}
                   onChange={(e) => setSign(e.target.value)}
                   placeholder={artist.trim() || 'Type your name'} />
            {sign && !signed && (
              <p className="ds-note ds-warn">That doesn&apos;t match the name above.</p>
            )}
          </div>

          {err && <p className="ds-note ds-warn" role="alert">{err}</p>}
        </div>

        <div className="ds-acts">
          {/* ⚠️ Enabled-looking-but-dead is worse than plainly disabled here:
              there are six fields and "why won't it go" needs an answer on
              the page, which is what ds-why is for. */}
          <button type="submit" className="ds-go" disabled={!ready}>Set it up</button>
          <button type="button" className="ds-cancel" onClick={onClose}>Cancel</button>
        </div>
        {!ready && !busy && (
          <p className="ds-why">
            {!artist.trim() ? 'Add the name it should be credited to.'
             : !title.trim() ? 'Give it a title.'
             : !hasSomething ? 'Add the file or a link.'
             : !signed ? 'Sign it with the name above.'
             : ''}
          </p>
        )}
      </form>
    </div>
  );
}
