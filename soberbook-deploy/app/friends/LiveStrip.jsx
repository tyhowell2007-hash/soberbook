'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import '../talk-entry.css';

/* =====================================================================
   🎙️ TALK ROOMS IN THE ROOMS PAGE — 1 Nov 2026.
   The 🎙️ Live tab beside the rooms, and a red strip at the top of a room
   while a talk is on in it. The chat underneath doesn't change.
   ===================================================================== */

export function useLiveTalks() {
  const [live, setLive] = useState([]);
  useEffect(() => {
    const sb = browserClient();
    let alive = true;
    const tick = async () => {
      const { data } = await sb.rpc('talks_live');
      if (alive && Array.isArray(data)) setLive(data);
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return live;
}

export function LiveTab({ live }) {
  return (
    <Link href="/talks" className="rtab rtab-live">
      <span aria-hidden="true">🎙️</span> Live{live.length > 0 && <span className="tkd" aria-label="someone is live" />}
    </Link>
  );
}

export default function LiveStrip({ live, room }) {
  const t = live.find((x) => x.room?.slug === room?.slug);
  if (!t) return null;
  const n = (t.speakers || []).length;
  return (
    <Link href={`/talks/${t.id}`} className="tk-strip">
      <span className="tk-stx">🔴 Live: {t.topic}
        <small>{n} talking · {t.listening} listening</small></span>
      <span className="tk-sgo">Join</span>
    </Link>
  );
}
