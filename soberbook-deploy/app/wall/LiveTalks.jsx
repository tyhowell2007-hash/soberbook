'use client';

import Link from 'next/link';
import { useLiveTalks } from '../friends/LiveStrip';
import '../talk-entry.css';

/* =====================================================================
   🔴 A LIVE TALK, ON THE WALL — 1 Nov 2026.
   Talk Rooms prototype, screen B: while somebody is live (and said "Say
   it on the wall"), one card sits near the top of Home. It disappears by
   itself when the talk ends (talks_live() sweeps a talk whose host has
   been gone two minutes). Returns null the rest of the time.
   ===================================================================== */
export default function LiveTalks() {
  const live = useLiveTalks().filter((t) => t.on_wall);
  if (!live.length) return null;
  const t = live[0];
  const sp = t.speakers || [];
  return (
    <Link href={`/talks/${t.id}`} className="tk-wallcard">
      <span className="tk-wic" aria-hidden="true">🎙️</span>
      <span className="tk-wtx">
        <span className="tk-wlive">● LIVE</span>
        <b>{sp[0] || t.host} is live: {t.topic}</b>
        <small>{t.room.emoji} {t.room.name.replace(/^The /, '')} · {t.listening} listening
          {live.length > 1 ? ` · +${live.length - 1} more live` : ''}</small>
      </span>
      <span className="tk-wgo">Join</span>
    </Link>
  );
}
