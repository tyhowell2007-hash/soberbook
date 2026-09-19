'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* Five seconds a photo or card — long enough to read 280 characters
   without hurrying, short enough that a rail of six is a minute. A video
   runs to its own end instead. */
const PHOTO_MS = 5000;

/* =====================================================================
   THE VIEWER.  18 Sept 2026.

   ⚠️ IT WALKS PEOPLE, NOT JUST STORIES. Reaching the end of somebody's
   stories moves to the next person in the rail, the way every app that
   does this works. Closing at the end of each person would make a rail
   of six people six separate journeys.

   🔴 seen_count IS ONLY EVER ON YOUR OWN, and that is enforced in SQL —
   story_open() returns NULL for anybody else's. This file could not show
   somebody else's number if it tried, which is the point: the rule lives
   where it cannot be edited out by a well-meaning change up here.
   ===================================================================== */
export default function StoryViewer({ rail, startAt, onClose }) {
  const supabase = browserClient();

  const [who, setWho]       = useState(startAt);
  const [items, setItems]   = useState([]);
  const [at, setAt]         = useState(0);
  const [held, setHeld]     = useState(false);
  const [loading, setLoading] = useState(true);

  const closeBtn = useRef(null);
  const startedAt = useRef(0);
  const left = useRef(PHOTO_MS);
  const timer = useRef(null);
  const vid = useRef(null);

  const person = rail[who];

  /* ---- load one person's stories ---- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    /* 🔴 19 Sept — PHOTO STORIES SHOWED A BROKEN IMAGE TO EVERYONE.
       story_open() returns STORAGE PATHS ("stories/….webp"), and the
       buckets are private, so <img src> on a path is a broken picture.
       Found by the bug sweep: 13 story_open calls, 0 signing requests.
       Same fix as the rail's avatars: the paths go through
       /api/photo/sign, which asks visible_stories whether this viewer
       may see them. Anything it won't sign becomes null and that story
       is skipped rather than shown broken. */
    (async () => {
      const { data } = await supabase.rpc('story_open', { p_author: person.author_id });
      const rows = data || [];
      const paths = [...new Set(rows.flatMap((r) => [r.photo_url, r.video_url]).filter(Boolean))];
      let urls = {};
      if (paths.length) {
        try {
          const res = await fetch('/api/photo/sign', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths }),
          });
          urls = (await res.json()).urls || {};
        } catch { /* fall through: media stories drop out below */ }
      }
      const ready = rows
        .map((r) => ({
          ...r,
          photo_url: r.photo_url ? (urls[r.photo_url] || null) : null,
          video_url: r.video_url ? (urls[r.video_url] || null) : null,
        }))
        .filter((r) => r.kind === 'text' || r.photo_url || r.video_url);
      if (!alive) return;
      setItems(ready);
      setAt(0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [supabase, person.author_id]);

  const here = items[at];

  /* ---- mark seen. Fire and forget: a failed write must never stop
         somebody watching, and the worst case is a ring stays bright. ---- */
  useEffect(() => {
    if (!here || here.is_mine) return;
    /* 🔴 .then() IS NOT DECORATION. A supabase-js query builder is lazy —
       it only sends the request when something awaits or thens it. The
       bare call that stood here never left the browser: views stayed at 0
       and rings never went grey. Found by the 19 Sept sweep (story_open
       in the logs, never story_seen). */
    supabase.rpc('story_seen', { p_story: here.id }).then(() => {}, () => {});
  }, [supabase, here]);

  /* ---- move ---- */
  const step = useCallback((d) => {
    setAt((i) => {
      const next = i + d;
      if (next >= 0 && next < items.length) return next;

      /* Off the end of this person — walk the rail. */
      const w = who + (next < 0 ? -1 : 1);
      if (w < 0 || w >= rail.length) { onClose(); return i; }
      setWho(w);
      return 0;
    });
  }, [items.length, who, rail.length, onClose]);

  /* ---- the clock ---- */
  useEffect(() => {
    if (!here || loading) return;
    /* A video keeps its own time — see onEnded below. */
    if (here.kind === 'video') return;

    left.current = PHOTO_MS;
    startedAt.current = Date.now();
    clearTimeout(timer.current);
    if (!held) timer.current = setTimeout(() => step(1), left.current);
    return () => clearTimeout(timer.current);
  }, [here, loading, held, step]);

  /* ⚠️ HOLD TO PAUSE, and it must keep the REMAINING time rather than
     restarting. Restarting means a long press near the end silently
     gives you the whole five seconds again, which is how a story you
     were reading carefully jumps away the moment you let go. */
  const hold = () => {
    if (!here || here.kind === 'video') { setHeld(true); vid.current?.pause(); return; }
    clearTimeout(timer.current);
    left.current = Math.max(0, left.current - (Date.now() - startedAt.current));
    setHeld(true);
  };
  const release = () => {
    setHeld(false);
    if (here?.kind === 'video') { vid.current?.play?.().catch(() => {}); return; }
    startedAt.current = Date.now();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => step(1), left.current);
  };

  /* ---- keyboard, scroll lock, focus ---- */
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape')     { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowRight') { e.stopPropagation(); step(1); }
      if (e.key === 'ArrowLeft')  { e.stopPropagation(); step(-1); }
    };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
      clearTimeout(timer.current);
    };
  }, [onClose, step]);

  async function remove() {
    if (!here?.is_mine) return;
    await supabase.rpc('story_delete', { p_story: here.id });
    const rest = items.filter((s) => s.id !== here.id);
    if (!rest.length) { onClose(); return; }
    setItems(rest);
    setAt((i) => Math.min(i, rest.length - 1));
  }

  const ago = (t) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  };

  return (
    <div className="sty-view" role="dialog" aria-modal="true"
         aria-label={`${person.display_name}'s story`}>

      <div className="sty-bars" aria-hidden="true">
        {items.map((s, i) => (
          <span key={s.id} className={'sty-seg' + (i < at ? ' sty-done' : '')}>
            <span className="sty-fill"
                  style={i === at ? {
                    width: '100%',
                    transition: here && here.kind !== 'video' && !held
                      ? `width ${PHOTO_MS}ms linear` : 'none',
                  } : undefined} />
          </span>
        ))}
      </div>

      <div className="sty-head">
        <span className="sty-face">
          {person.display_avatar_photo
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={person.display_avatar_photo} alt="" />
            : (person.display_avatar || person.display_name.slice(0, 1).toUpperCase())}
        </span>
        <span>
          <span className="sty-who">{person.display_name}</span>
          {here && <span className="sty-when"> · {ago(here.created_at)}</span>}
        </span>
        <button ref={closeBtn} type="button" className="sty-x"
                aria-label="Close" onClick={onClose}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="sty-stage"
           onPointerDown={hold} onPointerUp={release} onPointerCancel={release}>
        {here?.kind === 'text' && (
          <div className="sty-card" data-tint={here.tint || 'moss'}>{here.body}</div>
        )}
        {here?.kind === 'photo' && here.photo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="sty-img" src={here.photo_url} alt="" />
        )}
        {here?.kind === 'video' && here.video_url && (
          /* ⚠️ playsInline or iOS throws it into its own fullscreen player
             the moment it starts, and the person loses the story. */
          <video ref={vid} className="sty-vid" src={here.video_url}
                 autoPlay playsInline onEnded={() => step(1)} />
        )}

        <button type="button" className="sty-tapl" aria-label="Previous"
                onClick={() => step(-1)} />
        <button type="button" className="sty-tapr" aria-label="Next"
                onClick={() => step(1)} />
      </div>

      <div className="sty-foot">
        {/* A NUMBER, NEVER A LIST. See the header of this file. */}
        {here?.is_mine && here.seen_count !== null && (
          <span className="sty-count">
            {here.seen_count === 0
              ? 'Nobody has seen this yet'
              : `${here.seen_count} ${here.seen_count === 1 ? 'person has' : 'people have'} seen this`}
          </span>
        )}
        {here?.is_mine && (
          <button type="button" className="sty-del" onClick={remove}>Take it down</button>
        )}
      </div>
    </div>
  );
}
