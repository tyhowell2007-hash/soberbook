'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { watcherFor } from '../../lib/watch';

/* 0196 — once the member has TAPPED and the player is on screen, Cloudflare's
   own player SDK reports play/time/end so the post can count as WATCHED
   (3 seconds or more) and the author gets a "where people stopped" curve.
   🔴 The SDK is only fetched after the tap, from the same Cloudflare host
   that serves the player — nothing reaches Cloudflare before somebody
   chooses to watch. Numbers only ever come back out. */
const SDK = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
let sdkPromise = null;
function loadSdk() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Stream) return Promise.resolve(window.Stream);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = SDK; s.async = true;
      s.onload = () => resolve(window.Stream || null);
      s.onerror = () => { sdkPromise = null; resolve(null); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

/* =====================================================================
   A VIDEO THAT LIVES ON CLOUDFLARE, PLAYED ONLY WHEN SOMEBODY ASKS.

   🔴 NOTHING TOUCHES CLOUDFLARE UNTIL A TAP. Not the iframe, not a
   thumbnail, not a token. This is the 23 Aug rule about embeds, and the
   reason is stronger here than it was for song links: an iframe fires on
   RENDER, so scrolling past somebody's video would announce this member's
   browser — and by extension that they are in recovery — to a third party
   before a single frame played.

   ⚠️ So the resting state is drawn entirely by us: a black card, a play
   triangle, and a word. It costs one request when tapped and zero
   otherwise.

   ⚠️ It deliberately does NOT autoplay once the iframe appears either.
   The wall has never autoplayed video (0029): a video here is often
   somebody talking about the worst thing that ever happened to them, and
   it must not start playing to a room because a thumb moved. One tap
   opens the player; the second, inside Cloudflare's own controls, plays
   it.
   ===================================================================== */

export default function StreamVideo({ uid, label = 'Video', postId = null, mine = false }) {
  const [src, setSrc] = useState('');
  const frame = useRef(null);

  useEffect(() => {
    if (!src || mine || !postId || !frame.current) return undefined;
    let gone = false;
    let player = null;
    const w = watcherFor(browserClient(), postId);
    loadSdk().then((Stream) => {
      if (gone || !Stream || !frame.current) return;
      try {
        player = Stream(frame.current);
        player.addEventListener('play', () => w.play());
        player.addEventListener('timeupdate', () => w.progress(player.currentTime, player.duration));
        player.addEventListener('pause', () => w.stop(player.currentTime, player.duration));
        player.addEventListener('ended', () => w.stop(player.currentTime, player.duration));
      } catch { /* a count failing must never break the video */ }
    });
    return () => { gone = true; };
  }, [src, postId, mine]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function open() {
    if (busy || src) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/video/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const d = await r.json().catch(() => ({}));
      /* 202 means it exists and this person may watch it — it just is not
         finished encoding. That is a completely different sentence from
         "not available", and saying the right one is the difference
         between waiting a minute and giving up. */
      if (r.status === 202) {
        setMsg('Still processing — give it a minute and tap again.');
      } else if (!r.ok) {
        setMsg(d.error || "That video isn't available.");
      } else {
        setSrc(d.src);
      }
    } catch {
      setMsg("That video wouldn't open. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (src) {
    return (
      <div className="pphoto pvideo svwrap">
        <iframe
          ref={frame}
          src={src}
          className="svframe"
          title={label}
          allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="pphoto pvideo">
      {/* A real button, not a div with an onClick — it has to be reachable
          by a keyboard and announced by a screen reader, and the 44px
          floor from the Aug 18 tap-target fix applies here too. */}
      <button type="button" className="svplay" onClick={open} disabled={busy}
              aria-label={busy ? 'Opening the video' : `Play ${label}`}>
        <span className="svtri" aria-hidden="true">▶</span>
        <span className="svlabel">{busy ? 'Opening…' : label}</span>
      </button>
      {msg && <p className="phserr" role="status">{msg}</p>}
    </div>
  );
}
