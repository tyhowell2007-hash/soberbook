'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   SOMEBODY IS IN A ROOM RIGHT NOW — the card at the top of Home.

   🔴 WHY. On 2 Sept NotHigh opened "Wildin' on Wednesday" at 13:23:31.
   His presence beat once and he was gone inside a second. Ty walked in at
   13:56. Nic at 14:12. Three people wanted the same room on the same
   afternoon and not one of them overlapped — because the only way to find
   out a room was open was to open the Meetings tab at the right moment.
   `meeting_rooms` appeared in four files and none of them was the Wall.

   ⭐ THE ONE DESIGN DECISION, AND IT IS THE WHOLE CARD: IT NEVER PRINTS
   A ZERO, AND IT NEVER PRINTS A ONE AS A NUMBER.

   The Meetings tab says "nobody in yet" and that is right THERE, because
   you went looking. Pushing that same sentence onto 183 home screens
   broadcasts that a man is sitting in a room on his own. So:

       0 people  →  "NotHigh just opened a room"
       1 person  →  "NotHigh is in there"
       2+        →  "3 people in there"

   Honest at every level, humiliating at none. Every other app shows the
   count because the count is engagement; here the count is the exact
   thing that stops somebody walking in.

   ⚠️ ONE CARD, EVER — the fullest room, newest as the tie-break. Two
   cards is a directory, and a directory of thin rooms says "this place is
   dead" louder than no card at all. Same argument that set the trigger
   for opening a second Front Room (20+ messages/day from 6+ people).

   ⚠️ NO TOMBSTONE. When the room closes the card is simply gone. Nobody
   needs to be told they missed something.

   ⚠️ NO NOTIFICATION, AND THAT IS A PROMISE NOT A GAP. 130 members were
   emailed "no reminders, no streaks, no nudges to come back." A card on a
   screen they already chose to open is not a nudge. A push is. If this
   ever grows a notification, that email became a lie.

   ⚠️ NO ATTENDANCE, no "who's been in", no history — the same refusal as
   drops in August, for the same reason.
   ===================================================================== */

/* 🔴 BOTH HELPERS LIVE IN lib/open-room.js, NOT IN THIS FILE.

   They were here first, and app/wall/page.jsx — a SERVER component —
   imported pickRoom from here. Next.js turns every export of a
   'use client' module into a client reference, so the server got a proxy
   instead of a function, called it, and answered every member with
   "Application error: a server-side exception". The wall was down.

   ⚠️ The build was green throughout. It is a runtime failure and only
   loading the live page could ever have found it.

   ⚠️ Do NOT move them back in here to keep the component self-contained.
   A function two runtimes both need belongs to neither — same reason
   lib/previews.js and lib/drops.js sit in lib/ and take a client. */
import { whosThere, pickRoom } from '../../lib/open-room';

export default function OpenRoom({ initial = null }) {
  /* ⚠️ Seeded from the server so the card is present in the FIRST paint.
     Fetching it only in the browser would draw the wall, then drop a card
     in above it and shove every post down under somebody's thumb while
     they were already reading — the exact layout-shift problem the photos
     and reply previews are fetched server-side to avoid. */
  const [room, setRoom] = useState(initial);

  useEffect(() => {
    const supabase = browserClient();
    let alive = true;
    async function load() {
      /* ⚠️ Polling, not a realtime subscription. A subscription streams
         the ROW, and rows here carry host ids. Ask for the answer, not
         the record — same call as the owner dashboard and Rooms.jsx. */
      const { data } = await supabase
        .from('open_meeting_rooms')
        .select('room_key, title, host_name, is_mine, people, created_at');
      if (!alive) return;
      setRoom(pickRoom(data));
    }
    /* 30s. Deliberately NOT on mount — the server already gave us the
       answer a moment ago, and an immediate refetch is a wasted round
       trip on every single wall load in the app. */
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!room) return null;

  /* Your own room. Gold, and it says nothing about who is or isn't in
     there — its only job is telling the host the room IS visible, which
     is the thing NotHigh had no way of knowing. */
  if (room.is_mine) {
    return (
      <Link href={`/room/${room.room_key}`} className="orcard mine">
        <span className="orLive"><span className="orDot" aria-hidden="true" />Your room is open</span>
        <span className="orTtl">{room.title}</span>
        <span className="orWho">Everybody can see this on their home screen</span>
      </Link>
    );
  }

  return (
    <Link href={`/room/${room.room_key}`} className="orcard">
      <span className="orLive"><span className="orDot" aria-hidden="true" />Open right now</span>
      <span className="orTtl">{room.title}</span>
      <span className="orWho">{whosThere(room)}</span>
      <span className="orGo">Go sit with them ›</span>
    </Link>
  );
}
