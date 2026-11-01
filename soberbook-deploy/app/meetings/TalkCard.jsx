'use client';

import Link from 'next/link';
import { useLiveTalks } from '../friends/LiveStrip';
import '../talk-entry.css';

/* =====================================================================
   🎙️ TALK ROOMS AT THE TOP OF MEETINGS — 1 Nov 2026, "Option 1".

   Ty: "we can take out the whole start a room and figure out a place to
   put your whole new map." Picked from three prototypes: "I think option
   one's the best."

   ⭐ IT REPLACES <Rooms /> (the Daily "Start a room" box). Six rooms ever,
   the last on 22 Oct, buried under the NA list. Talk Rooms is the one way
   to talk live now. Rooms.jsx, /room/[key] and the Daily route are left
   in the repo, unlinked, so nothing in flight breaks; delete later.

   Shows up to two live talks with Join, then Start a talk / See all live.
   Polls via useLiveTalks (20s), so a talk that starts while you're
   reading the meeting list shows up without a refresh.
   ===================================================================== */
export default function TalkCard() {
  const live = useLiveTalks();
  const shown = live.slice(0, 2);
  return (
    <section className="tk-mcard" aria-label="Talk Rooms">
      <div className="tk-mh">
        <span className="tk-mic" aria-hidden="true">🎙️</span>
        <span><b>Talk Rooms</b><small>Live voice with people who get it · nothing recorded</small></span>
      </div>
      {shown.length === 0 && <p className="tk-mempty">Nobody’s live right now. Start one and people will drop in.</p>}
      {shown.map((t) => {
        const sp = t.speakers || [];
        const who = sp.length === 0 ? 'Starting up'
          : sp.length === 1 ? `${sp[0]} talking`
          : `${sp.slice(0, -1).join(', ')} and ${sp[sp.length - 1]} talking`;
        return (
          <Link key={t.id} href={`/talks/${t.id}`} className="tk-mlive">
            <span className="tk-mtx"><span className="tk-mtag">● LIVE</span>{t.topic}
              <small>{t.room.emoji} {t.room.name.replace(/^The /, '')} · {who} · {t.listening} listening</small></span>
            <span className="tk-mgo">Join</span>
          </Link>
        );
      })}
      <div className="tk-mfoot">
        <Link href="/talks?start=front-room" className="tk-ma">🎙️ Start a talk</Link>
        <Link href="/talks" className="tk-mb">{live.length > 2 ? `See all ${live.length} live` : 'See all live'}</Link>
      </div>
    </section>
  );
}
