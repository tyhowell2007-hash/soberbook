/* =====================================================================
   WHICH ROOM TO SHOW, AND WHAT TO SAY ABOUT IT.

   🔴 THIS FILE EXISTS BECAUSE I TOOK THE WALL DOWN, 2 Sept.

   Both helpers started life inside app/wall/OpenRoom.jsx, which is a
   'use client' module. app/wall/page.jsx is a SERVER component and did:

       import OpenRoom, { pickRoom } from './OpenRoom';

   ⚠️ Importing the DEFAULT export of a client component into a server
   component is normal and correct — that is how you render one. But
   Next.js turns EVERY export of a 'use client' module into a client
   reference, so `pickRoom` arrived on the server as a proxy object, not
   a function. Calling it during server render threw, and /wall answered
   every member with "Application error: a server-side exception".

   🔴 THE BUILD WAS GREEN THE WHOLE TIME. Nothing about this is a
   compile error — it is a runtime one, and the only way it was ever
   going to be found was loading the live page. A green Vercel build
   proves the code compiles, not that the page opens. That is written in
   this workspace's notes from 20 Aug and I walked into it anyway.

   ⭐ THE RULE, and it is the same one 0046→0049 keeps teaching in SQL:
   a function two runtimes both need belongs to NEITHER of them. It
   lives in lib/, with no 'use client' at the top, exactly like
   lib/previews.js and lib/drops.js — which are shared by the server
   page and the browser for the identical reason.

   ⚠️ Do not "tidy" these back into the component. The moment they live
   inside a 'use client' file, the server cannot call them again.
   ===================================================================== */

/* 🔴 NEVER PRINTS A ZERO, AND NEVER PRINTS A ONE AS A NUMBER.

   The Meetings tab says "nobody in yet" and that is right THERE, because
   you went looking. Pushing that same sentence onto 183 home screens
   broadcasts that somebody is sitting in a room on their own. */
export function whosThere(room) {
  const n = Number(room?.people) || 0;
  if (n >= 2) return `${n} people in there`;
  if (n === 1) return `${room.host_name} is in there`;
  return `${room.host_name} just opened a room`;
}

/* The fullest room wins; if two are level, the newest.
   ⚠️ ONE card ever — two is a directory, and a directory of thin rooms
   says "this place is dead" louder than no card at all. */
export function pickRoom(rows) {
  if (!rows || !rows.length) return null;
  return [...rows].sort((a, b) =>
    (Number(b.people) || 0) - (Number(a.people) || 0) ||
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )[0];
}
