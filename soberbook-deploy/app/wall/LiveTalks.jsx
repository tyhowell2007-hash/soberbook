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
  // 2 Nov 2026 (0201): camera or voice, seats open. The picture is DRAWN,
  // never the live feed — nobody is watched before they choose to join.
  const cam = !t.room.anonymous && (t.cams > 0 || t.kind === 'video');
  const open = Math.max(0, 4 - sp.length);
  const others = sp.slice(1);
  return (
    <Link href={`/talks/${t.id}`} className={'tk-wallcard v2' + (cam ? ' cam' : '')}>
      <span className="tk-wtop">
        <span className="tk-wlive">● LIVE</span>
        <span className="tk-wpill">🎧 {t.listening}</span>
        <span className="tk-wpill">{cam ? '🎥 Camera + voice' : '🎙 Voice'}</span>
      </span>
      <span className="tk-wtx">
        <b>{sp[0] || t.host} is live: {t.topic}</b>
        <small>{t.room.emoji} {t.room.name.replace(/^The /, '')}
          {others.length ? ` · with ${others.join(' and ')}` : ''}
          {t.requests !== 'off' && open > 0 ? ` · ${open} seat${open === 1 ? '' : 's'} open` : ''}
          {live.length > 1 ? ` · +${live.length - 1} more live` : ''}</small>
      </span>
      <span className="tk-wbtns"><span className="tk-wgo">🎧 Listen</span>
        {t.requests !== 'off' && open > 0 && <span className="tk-wask">✋ Ask to join</span>}</span>
    </Link>
  );
}
