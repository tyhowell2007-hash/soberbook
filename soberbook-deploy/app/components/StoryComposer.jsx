'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import PhotoUpload from './PhotoUpload';

const MAX = 280;

/* The four tints, and their ink. ⚠️ A PAIR, decided and measured
   together — the 13 Sept bug was a slab built out of a text variable,
   which flipped in the dark and measured 1.04:1. Same values as
   stories.css; measured moss 11.68 · clay 11.69 · night 14.87 · dawn 11.07 */
const TINTS = [
  { key: 'moss',  bg: '#12331F', ink: '#D9F2E2', label: 'Moss'  },
  { key: 'clay',  bg: '#3A2015', ink: '#F4DFD2', label: 'Clay'  },
  { key: 'night', bg: '#0B1220', ink: '#DCE6F5', label: 'Night' },
  { key: 'dawn',  bg: '#3A2F0E', ink: '#F6EBC8', label: 'Dawn'  },
];

/* =====================================================================
   THE COMPOSER.  18 Sept 2026.

   ⭐ THE TEXT CARD IS THE DEFAULT, and that is the most important
   decision in this file. Every other app opens the camera. At 3am
   somebody has something to say and nothing to photograph, and an app
   that demands a picture first tells them to come back when they have
   one. Photo and video are a tap away; words are already here.
   ===================================================================== */
export default function StoryComposer({ onClose }) {
  const supabase = browserClient();
  const [body, setBody]   = useState('');
  const [tint, setTint]   = useState('moss');
  const [media, setMedia] = useState(null);   // { path, preview, isVideo }
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const ta = useRef(null);
  const box = useRef(null);

  /* 🔴 19 Sept — NICK: "STORY MODE HAD NO POST BUTTON."
     On an iPhone the keyboard does not shrink a position:fixed box. The
     composer focuses the text box on open, the keyboard comes up, and the
     footer — which held the ONLY "Add to story" button — sat underneath
     it. On a laptop there is no keyboard, which is why every test passed.
     Two fixes, belt and braces:
       1. the send button now lives in the HEADER, top right, where the
          keyboard can never reach (Instagram puts "Share" there too);
       2. the box is sized to the VISIBLE viewport, so the footer rides
          up above the keyboard instead of hiding behind it. */
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const el = box.current;
    if (!vv || !el) return;
    const fit = () => {
      el.style.height = vv.height + 'px';
      el.style.top = vv.offsetTop + 'px';
      el.style.bottom = 'auto';
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', key);
    ta.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const over = body.length > MAX;
  const ready = !busy && (media ? true : body.trim().length > 0) && !over;

  async function send() {
    if (!ready) return;
    setBusy(true); setErr('');
    try {
      const kind = media ? (media.isVideo ? 'video' : 'photo') : 'text';
      const { error } = await supabase.rpc('story_post', {
        p_kind: kind,
        p_photo: kind === 'photo' ? media.path : null,
        p_video: kind === 'video' ? media.path : null,
        /* A caption rides along with a picture; on a text card it IS the
           story. Either way the same column, so there is one thing to
           read and one thing to moderate. */
        p_body: body.trim() || null,
        p_tint: kind === 'text' ? tint : null,
        p_audience: 'open',
      });
      if (error) { setErr(error.message); setBusy(false); return; }
      onClose();
    } catch {
      setErr('That did not send. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <div className="sty-comp" ref={box} role="dialog" aria-modal="true" aria-label="Add to your story">
      <div className="sty-chead">
        <button type="button" className="sty-x" aria-label="Close" onClick={onClose}
                style={{ color: 'var(--body)', marginLeft: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="sty-ctitle">Your story</span>
        {/* ⭐ THE ONE SEND BUTTON, up here where no keyboard can cover it.
            See the 19 Sept note at the top of this component. */}
        <button type="button" className="sty-send" disabled={!ready} onClick={send}>
          {busy ? 'Sending…' : 'Post'}
        </button>
      </div>

      <div className="sty-cbody">
        {media ? (
          <div className="sty-card" data-tint={tint}
               style={{ aspectRatio: 'auto', padding: 0, background: 'var(--gl)' }}>
            {media.isVideo
              ? <video src={media.preview} controls playsInline
                       style={{ width: '100%', borderRadius: 14 }} />
              /* eslint-disable-next-line @next/next/no-img-element */
              : <img src={media.preview} alt=""
                     style={{ width: '100%', borderRadius: 14, display: 'block' }} />}
          </div>
        ) : (
          /* sty-mini: a 9:16 preview is a whole phone screen tall and
             shoved the text box below the fold. Same card, shorter. */
          <div className="sty-card sty-mini" data-tint={tint}
               aria-hidden="true">{body.trim() || 'It disappears in a day.'}</div>
        )}

        <label className="sr-only" htmlFor="sty-text">What do you want to say?</label>
        <textarea id="sty-text" ref={ta} className="sty-ta" value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={media ? 'Say something about it (optional)' : 'Say it here. It is gone tomorrow.'} />

        <p className={'sty-left' + (over ? ' sty-over' : '')}>
          {over ? `${body.length - MAX} over` : `${MAX - body.length} left`}
        </p>

        {!media && (
          <div className="sty-tints" role="group" aria-label="Background">
            {TINTS.map((t) => (
              <button key={t.key} type="button" className="sty-tint"
                      aria-pressed={tint === t.key} aria-label={t.label}
                      style={{ background: t.bg, color: t.ink }}
                      onClick={() => setTint(t.key)}>Aa</button>
            ))}
          </div>
        )}

        {/* ⚠️ THE SAME SENTENCE THE ROOM SAYS, and a story reaches further
            than a room does. A name can be hidden; a kitchen cannot. */}
        {media && (
          <p className="sty-warn">
            <span aria-hidden="true">🕶️ </span>
            A photo isn’t anonymous — check for faces, and anything behind them.
          </p>
        )}

        {err && <p className="sty-left sty-over" role="alert">{err}</p>}
      </div>

      <div className="sty-cfoot">
        {!media && (
          <PhotoUpload
            kind="story"
            className="btn ghost"
            label="📷 Photo or video"
            accept="image/*,video/*"
            onBusy={setBusy}
            onDone={(path, preview, isVideo) => setMedia({ path, preview, isVideo })}
          />
        )}
        {media && (
          <button type="button" className="btn ghost" onClick={() => setMedia(null)}>
            Take it off
          </button>
        )}
      </div>
    </div>
  );
}
