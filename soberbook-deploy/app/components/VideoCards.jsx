'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Coin from './Coin';
import { coinTotal, topKinds } from '../../lib/coins';
import { cardColors } from '../../lib/video-colors';
import './video-cards.css';

/* =====================================================================
   THE VIDEOS TAB ON A PROFILE.  31 Oct 2026 (0197) — piece 3.

   One drawn card per video, newest first: the member's day count on the
   day they posted it (or the date), how long it is, how many watched and
   how many coins. Tapping a card opens the full-screen player at that
   video, with only this member's videos to swipe through.

   🔴 THESE ARE NOT THUMBNAILS. Nothing is fetched from Cloudflare to draw
   them, so scrolling somebody's profile tells no third party anything.
   The colours come from the post id.
   ===================================================================== */
const clock = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function VideoCards({ videos, handle, dayNow = null }) {
  const [len, setLen] = useState({});
  useEffect(() => {
    if (!videos.length) return;
    browserClient().rpc('video_meta', { p_posts: videos.map((v) => v.id) }).then(({ data }) => {
      const m = {};
      (data || []).forEach((r) => { if (r.duration) m[r.post_id] = Number(r.duration); });
      setLen(m);
    });
  }, [videos]);

  return (
    <div>
      <div className="vcards">
        {videos.map((v) => {
          const [a, b] = cardColors(v.id);
          const back = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000);
          const day = dayNow != null && dayNow - back > 0 ? dayNow - back : null;
          const total = coinTotal(v);
          const seenN = Number(v.seen_count);
          const seen = v.seen_count == null ? '' : (!v.is_mine && seenN < 10) ? '✨ New' : `${seenN} watched`;
          return (
            <Link key={v.id} className="vcard" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
                  href={`/videos?u=${encodeURIComponent(handle)}&v=${v.id}`}
                  aria-label={`Watch the video from ${new Date(v.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}>
              {len[v.id] ? <span className="vcard-len">{clock(len[v.id])}</span> : null}
              {day ? <span className="vcard-day"><small>DAY</small>{day.toLocaleString()}</span>
                   : <span className="vcard-day"><small>{new Date(v.created_at).getFullYear()}</small>{new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).toUpperCase()}</span>}
              <span className="vcard-play" aria-hidden="true">▶</span>
              <span className="vcard-foot">
                <span>{new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</span>
                <span className="vcard-row">
                  <span>{seen}</span>
                  {total ? <span>{topKinds(v, 2).map((k) => <Coin key={k} kind={k} size={13} />)} {total}</span> : null}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <p className="vcards-note">Newest first. Nothing loads from the video until you tap one.</p>
    </div>
  );
}
