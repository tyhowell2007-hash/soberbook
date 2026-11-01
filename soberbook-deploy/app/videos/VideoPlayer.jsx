'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import { watcherFor } from '../../lib/watch';
import Coin from '../components/Coin';
import CoinSheet from '../components/CoinSheet';
import { COIN, coinTotal, topKinds, myCoin, applyCoin } from '../../lib/coins';
import { cardColors } from '../../lib/video-colors';

/* =====================================================================
   THE FULL-SCREEN PLAYER.  31 Oct 2026 (0197) — piece 3, from the
   prototype Ty approved ("i love it all").

   One video on screen at a time, newest first. Swipe up (or ↓ / the
   chevron) for the next one.

   🔴 NO AUTOPLAY. Each video starts as a card WE draw: the day count (or
   the date), the length if we know it, a play button and the line
   "Nothing loads until you tap." The Cloudflare token is minted on that
   tap and not one moment before, exactly like StreamVideo on the wall.
   Moving to the next video never starts it.

   ⭐ DROP A COIN AT A MOMENT. The coin button pauses the video and opens
   the coin sheet titled "Drop a coin at 0:23"; send_coin() saves the
   second (p_at, 0195). The coin then sits on OUR timeline under the
   video, and as anybody plays past a moment, those coins float up off
   it. Where most coins bunch together the timeline says "most felt here".

   ⚠️ OUR TIMELINE SITS UNDER THE VIDEO, NOT ON TOP OF IT. Cloudflare's
   own play button and controls live inside their frame, and a phone only
   lets a video start with sound from a tap inside that frame. Covering
   it would trade a working Play button for a prettier one. Our timeline
   follows the player and can scrub it; theirs does the playing.

   🔴 Numbers only. The end card says, in words, that nobody can see who
   watched. video_meta() hands back a coin and a second per moment and
   nothing that could name who dropped it.
   ===================================================================== */

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

const clock = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
const ago = (ts) => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
};
function peakOf(moments) {
  const b = {};
  let best = null; let n = 0;
  moments.forEach((m) => { const x = Math.round(m.s / 2) * 2; b[x] = (b[x] || 0) + 1; if (b[x] > n) { n = b[x]; best = x; } });
  return n >= 2 ? best : null;
}

export default function VideoPlayer({ videos: initial, startId, title, back }) {
  const router = useRouter();
  const supabase = browserClient();
  const [videos, setVideos] = useState(initial);
  const [idx, setIdx] = useState(() => Math.max(0, initial.findIndex((v) => v.id === startId)));
  const [meta, setMeta] = useState({});
  const [toast, setToast] = useState(null);

  /* The drawn cards' lengths and every coin's moment, for the whole list,
     in one call. Nothing from Cloudflare. */
  useEffect(() => {
    const ids = initial.map((v) => v.id);
    if (!ids.length) return;
    supabase.rpc('video_meta', { p_posts: ids }).then(({ data }) => {
      const m = {};
      (data || []).forEach((r) => {
        m[r.post_id] = { duration: Number(r.duration) || 0, moments: Array.isArray(r.moments) ? r.moments : [] };
      });
      setMeta(m);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const v = videos[idx];

  const go = useCallback((d) => {
    setIdx((i) => {
      const n = i + d;
      return n < 0 || n >= videos.length ? i : n;
    });
  }, [videos.length]);

  /* Keep the address on the video you are looking at, so Back from a
     profile or a shared link returns here. */
  useEffect(() => {
    if (!v) return;
    const u = new URL(window.location.href);
    u.searchParams.set('v', v.id);
    window.history.replaceState(null, '', u.toString());
  }, [v]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input, textarea, [role="dialog"]')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); go(-1); }
      if (e.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* Lock the page behind us so a swipe moves videos, not the wall. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function leave() {
    if (window.history.length > 1) router.back();
    else router.push(back || '/wall');
  }

  function say(text, kind) {
    setToast({ text, kind, k: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.k > 2400 ? null : t)), 2600);
  }

  function coinSent(post, kind, at) {
    setVideos((list) => list.map((x) => (x.id === post.id ? { ...applyCoin(x, myCoin(x), kind), my_coin: kind } : x)));
    if (kind && at != null) {
      setMeta((m) => {
        const cur = m[post.id] || { duration: 0, moments: [] };
        return { ...m, [post.id]: { ...cur, moments: [...cur.moments.filter((x) => !x.me), { s: at, k: kind, me: true }] } };
      });
      say(`${COIN[kind].name} dropped at ${clock(at)}`, kind);
    } else if (kind) {
      say(`${COIN[kind].name} sent`, kind);
    } else {
      setMeta((m) => {
        const cur = m[post.id];
        return cur ? { ...m, [post.id]: { ...cur, moments: cur.moments.filter((x) => !x.me) } } : m;
      });
      say('Coin taken back');
    }
  }

  if (!v) {
    return (
      <div className="vp">
        <div className="vp-top"><button type="button" className="vp-iconbtn" onClick={leave} aria-label="Back">←</button><span className="vp-title">{title}</span></div>
        <div className="vp-empty">
          <p>No videos here yet.</p>
          <p className="vp-small">When somebody posts a video, it shows up here, newest first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vp">
      <div className="vp-top">
        <button type="button" className="vp-iconbtn" onClick={leave} aria-label="Back">←</button>
        <span className="vp-title">{title}</span>
        <span className="vp-pos">{idx + 1} / {videos.length} · newest first</span>
        <button type="button" className="vp-iconbtn" onClick={() => go(-1)} disabled={idx === 0} aria-label="Newer video">▲</button>
        <button type="button" className="vp-iconbtn" onClick={() => go(1)} disabled={idx === videos.length - 1} aria-label="Older video">▼</button>
      </div>
      <Slide key={v.id} v={v} meta={meta[v.id]} next={videos[idx + 1]} onNext={() => go(1)}
             onSwipe={go} supabase={supabase} onCoin={coinSent} say={say} />
      {toast ? (
        <div className="vp-toast" role="status" key={toast.k}>
          {toast.kind ? <Coin kind={toast.kind} size={20} /> : null}<span>{toast.text}</span>
        </div>
      ) : null}
    </div>
  );
}

function Slide({ v, meta, next, onNext, onSwipe, supabase, onCoin, say }) {
  const [open, setOpen] = useState(false);      // tapped: the player is on screen
  const [src, setSrc] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(meta?.duration || 0);
  const [ended, setEnded] = useState(false);
  const [sheet, setSheet] = useState(null);      // null | {at}
  const [floaters, setFloaters] = useState([]);
  const [felt, setFelt] = useState(null);
  const frame = useRef(null);
  const video = useRef(null);
  const player = useRef(null);
  const lastT = useRef(0);
  const touch = useRef(null);

  useEffect(() => { if (!dur && meta?.duration) setDur(meta.duration); }, [meta, dur]);

  const moments = meta?.moments || [];
  const length = dur || meta?.duration || 0;
  const peak = peakOf(moments);
  const mine = myCoin(v);

  /* Coins float up off the timeline as playback passes their second. */
  const onTime = useCallback((now, d) => {
    if (d && d !== dur) setDur(d);
    const before = lastT.current;
    lastT.current = now;
    setT(now);
    if (now > before && now - before < 2) {
      const crossed = moments.filter((m) => m.s > before && m.s <= now);
      if (crossed.length) {
        const total = d || length || 1;
        const add = crossed.map((m, i) => ({ id: `${m.s}-${i}-${Math.random()}`, k: m.k, left: (m.s / total) * 100,
          dx: Math.round(Math.random() * 50 - 25), rot: Math.round(Math.random() * 50 - 25) }));
        setFloaters((f) => [...f, ...add]);
        setTimeout(() => setFloaters((f) => f.filter((x) => !add.includes(x))), 1700);
      }
      if (peak != null && before < peak && now >= peak) {
        const n = moments.filter((m) => Math.abs(m.s - peak) <= 3).length;
        setFelt(`${n} ${n === 1 ? 'person' : 'people'} felt this part`);
        setTimeout(() => setFelt(null), 2300);
      }
    }
  }, [moments, peak, length, dur]);

  /* Cloudflare: the SDK is fetched after the tap, from Cloudflare's own
     host, and only reports numbers back. The watched count still goes
     through watch.js exactly as it does on the wall. */
  useEffect(() => {
    if (!src || !frame.current) return undefined;
    let gone = false;
    const w = v.is_mine ? null : watcherFor(supabase, v.id);
    loadSdk().then((Stream) => {
      if (gone || !Stream || !frame.current) return;
      try {
        const p = Stream(frame.current);
        player.current = p;
        p.addEventListener('play', () => { setEnded(false); w && w.play(); });
        p.addEventListener('timeupdate', () => { onTimeRef.current(p.currentTime, p.duration); w && w.progress(p.currentTime, p.duration); });
        p.addEventListener('durationchange', () => p.duration && setDur(p.duration));
        p.addEventListener('pause', () => { w && w.stop(p.currentTime, p.duration); });
        p.addEventListener('ended', () => { w && w.stop(p.currentTime, p.duration); setEnded(true); });
      } catch { /* the video still plays in Cloudflare's own controls */ }
    });
    return () => { gone = true; player.current = null; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  const onTimeRef = useRef(onTime);
  useEffect(() => { onTimeRef.current = onTime; }, [onTime]);

  async function tap() {
    if (open || busy) return;
    if (v.stream_uid) {
      setBusy(true); setMsg('');
      try {
        const r = await fetch('/api/video/token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: v.stream_uid }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 202) setMsg('Still processing. Give it a minute and tap again.');
        else if (!r.ok) setMsg(d.error || 'That video isn’t available.');
        else { setSrc(`${d.src}${d.src.includes('?') ? '&' : '?'}autoplay=true`); setOpen(true); }
      } catch {
        setMsg('That video wouldn’t open. Try again.');
      } finally { setBusy(false); }
    } else if (v.src) {
      setOpen(true);
    } else {
      setMsg('That video isn’t available.');
    }
  }

  /* Our own stored videos: play inside the same tap. */
  useEffect(() => {
    if (open && !v.stream_uid && video.current) {
      video.current.play().catch(() => {});
    }
  }, [open, v.stream_uid]);

  function seekTo(x) {
    const s = Math.max(0, Math.min(length || 0, x));
    if (player.current) { try { player.current.currentTime = s; } catch { /* ignore */ } }
    if (video.current) { try { video.current.currentTime = s; } catch { /* ignore */ } }
    lastT.current = s;
    setT(s);
    if (ended && s < (length || 0) - 0.5) setEnded(false);
  }
  function pauseAll() {
    try { player.current && player.current.pause(); } catch { /* ignore */ }
    try { video.current && video.current.pause(); } catch { /* ignore */ }
  }
  function again() {
    setEnded(false);
    seekTo(0);
    try { player.current && player.current.play(); } catch { /* ignore */ }
    try { video.current && video.current.play(); } catch { /* ignore */ }
  }
  function coinButton() {
    if (v.is_mine) return;
    const at = open && !ended && t > 0 ? Math.round(t * 10) / 10 : null;
    pauseAll();
    setSheet({ at });
  }

  const track = useRef(null);
  const drag = useRef(false);
  function scrubAt(e) {
    if (!track.current || !length) return;
    const r = track.current.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * length);
  }

  const [c0, c1] = cardColors(v.id);
  const seenN = Number(v.seen_count);
  const seen = v.seen_count == null ? 'Watched' : (!v.is_mine && seenN < 10) ? '✨ New' : `${seenN.toLocaleString()} watched`;
  const who = v.is_mine ? 'You' : v.author_handle ? `@${v.author_handle}` : (v.display_name || 'Somebody');
  const kinds = topKinds(v);
  const total = coinTotal(v);
  const groups = {};
  moments.forEach((m) => { const x = Math.round(m.s); (groups[x] = groups[x] || []).push(m); });

  return (
    <div className="vp-slide"
         onTouchStart={(e) => { if (!open) touch.current = { y: e.touches[0].clientY, t: Date.now() }; }}
         onTouchEnd={(e) => {
           if (!touch.current) return;
           const dy = e.changedTouches[0].clientY - touch.current.y;
           const quick = Date.now() - touch.current.t < 700;
           touch.current = null;
           if (quick && Math.abs(dy) > 60) onSwipe(dy < 0 ? 1 : -1);
         }}>
      <div className="vp-stage">
        {!open ? (
          <button type="button" className="vp-poster" style={{ background: `linear-gradient(160deg, ${c0}, ${c1})` }}
                  onClick={tap} disabled={busy} aria-label={`Play ${v.is_mine ? 'your' : who + '’s'} video`}>
            <span className="vp-plabel">{v.is_mine ? 'Your video' : who}</span>
            {v.day ? <span className="vp-pday">DAY {v.day.toLocaleString()}</span>
                   : <span className="vp-pday">{new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).toUpperCase()}</span>}
            <span className="vp-plabel">{length ? `${clock(length)} · ` : ''}{ago(v.created_at)}</span>
            <span className="vp-play" aria-hidden="true"><i /></span>
            <span className="vp-quiet">{busy ? 'Opening…' : msg || 'Nothing loads until you tap.'}</span>
          </button>
        ) : v.stream_uid ? (
          <iframe ref={frame} src={src} className="vp-frame" title={`${who}’s video`}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />
        ) : (
          <video ref={video} src={v.src} className="vp-video" controls playsInline preload="none"
                 onTimeUpdate={(e) => onTime(e.currentTarget.currentTime, e.currentTarget.duration)}
                 onDurationChange={(e) => e.currentTarget.duration && setDur(e.currentTarget.duration)}
                 onEnded={() => setEnded(true)} />
        )}

        <div className="vp-rail">
          {v.is_mine ? (
            <a className="vp-rbtn vp-how" href={`/p/${v.id}/stats`}><span className="vp-ic">📈</span>Ripple</a>
          ) : (
            <button type="button" className={'vp-rbtn' + (mine ? ' has' : '')} onClick={coinButton}
                    aria-label={mine ? `You sent ${COIN[mine]?.name}. Change it` : open ? `Drop a coin at ${clock(t)}` : 'Send a coin'}>
              <span className="vp-ring">{mine ? <Coin kind={mine} size={50} /> : <Coin kind="proud" size={28} className="vp-ghost" />}</span>
              {mine ? 'Sent' : 'Coin'}
            </button>
          )}
          <a className="vp-rbtn" href={`/p/${v.id}`}><span className="vp-ic">💬</span>{Number(v.comment_count) || 0}</a>
        </div>

        {felt ? <div className="vp-felt" role="status">{felt}</div> : null}

        {ended ? (
          <div className="vp-end">
            <h2>{v.is_mine ? 'Your video, so far.' : 'You watched to the end.'}</h2>
            {total ? (
              <p className="vp-sum">
                <span className="vp-stack" aria-hidden="true">{kinds.map((k) => <Coin key={k} kind={k} size={28} />)}</span>
                <span><b>{total.toLocaleString()}</b> {total === 1 ? 'coin' : 'coins'}{peak != null ? <> · most landed at <b>{clock(peak)}</b></> : null}</span>
              </p>
            ) : null}
            <div className="vp-ebtns">
              {v.is_mine ? (
                <a className="vp-ebtn main" href={`/p/${v.id}/stats`}>📈 Open Ripple</a>
              ) : mine ? (
                <div className="vp-ebtn sent"><Coin kind={mine} size={22} /> You sent {COIN[mine]?.name}</div>
              ) : (
                <button type="button" className="vp-ebtn main" onClick={() => setSheet({ at: null })}>
                  <Coin kind="proud" size={22} /> Send {who} a coin
                </button>
              )}
              <a className="vp-ebtn" href={`/p/${v.id}`}>💬 Reply</a>
              <button type="button" className="vp-ebtn" onClick={again}>↺ Watch again</button>
            </div>
            {next ? (
              <button type="button" className="vp-next" onClick={onNext}>
                <span className="vp-mini" style={{ background: `linear-gradient(160deg, ${cardColors(next.id)[0]}, ${cardColors(next.id)[1]})` }}>▶</span>
                <span><small>Next · tap to see it</small>{next.is_mine ? 'Your video' : next.author_handle ? `@${next.author_handle}` : 'A video'}</span>
              </button>
            ) : null}
            <p className="vp-nobody">
              {v.is_mine
                ? 'You see numbers and the coins people chose to send. Nobody, including you, can see who watched.'
                : `Nobody sees who watched. Not ${who}, not other members, not the Sober Book team. Numbers only.`}
            </p>
          </div>
        ) : null}
      </div>

      <div className="vp-info">
        <div className="vp-who"><b>{who}</b>{v.day ? <span className={'vp-chip' + (v.day >= 365 ? ' gold' : '')}>Day {v.day.toLocaleString()}</span> : null}</div>
        {v.body ? <p className="vp-cap">{v.body}</p> : null}
        <p className="vp-meta">
          <span>{seen}</span>
          {total ? <><span className="vp-stack" aria-hidden="true">{kinds.map((k) => <Coin key={k} kind={k} size={15} />)}</span><span>{total} {total === 1 ? 'coin' : 'coins'}</span></> : null}
        </p>

        <div className="vp-track" ref={track}
             onPointerDown={(e) => { if (!open || !length) return; drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e); }}
             onPointerMove={(e) => { if (drag.current) scrubAt(e); }}
             onPointerUp={() => { drag.current = false; }}
             role="slider" aria-label="Where you are in the video" aria-valuemin={0}
             aria-valuemax={Math.round(length || 0)} aria-valuenow={Math.round(t)} aria-valuetext={`${clock(t)} of ${clock(length)}`}>
          <div className="vp-line" />
          {peak != null && length ? <div className="vp-glow" style={{ left: `${Math.max(0, ((peak - 3) / length) * 100)}%`, width: `${(6 / length) * 100}%` }} /> : null}
          <div className="vp-fill" style={{ width: length ? `${(t / length) * 100}%` : 0 }} />
          {length ? Object.entries(groups).map(([x, ms]) => {
            const me = ms.find((m) => m.me);
            const k = me ? me.k : ms[0].k;
            return <span key={x} className={'vp-mk' + (me ? ' me' : '')} style={{ left: `${(Number(x) / length) * 100}%` }}><Coin kind={k} size={me ? 22 : 16} /></span>;
          }) : null}
          {peak != null && length ? <span className="vp-peak" style={{ left: `${Math.min(86, Math.max(14, (peak / length) * 100))}%` }}>most felt here</span> : null}
          {open && length ? <div className="vp-knob" style={{ left: `${(t / length) * 100}%` }} /> : null}
          {floaters.map((f) => (
            <span key={f.id} className="vp-float" style={{ left: `${f.left}%`, '--dx': `${f.dx}px`, '--rot': `${f.rot}deg` }}>
              <Coin kind={f.k} size={26} />
            </span>
          ))}
        </div>
        <div className="vp-times"><span>{clock(t)}</span><span>{length ? clock(length) : ''}</span></div>
      </div>

      {sheet ? (
        <CoinSheet postId={v.id} to={who} current={mine} at={sheet.at} allowWords={v.coin_words !== false}
                   onClose={() => setSheet(null)}
                   onDone={(kind) => { const at = sheet.at; setSheet(null); onCoin(v, kind, kind ? at : null); }} />
      ) : null}
    </div>
  );
}
