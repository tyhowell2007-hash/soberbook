/* =====================================================================
   THE WALKTHROUGH PLAYER.

   🔴🔴 THE CHAPTER LIST IS GONE, AND IT HAD TO GO — 2 Sept.

   This file used to carry seventeen clickable timestamps running to
   12:41. They were generated from the FOURTEEN-minute cut. The film was
   then re-cut to 3:29 and the array was never regenerated, so TWELVE OF
   THE SEVENTEEN pointed past the end of the video. Tapping "Meeting
   rooms · 09:23" threw you to the end of a three-and-a-half-minute film.

   ⭐ The old comment in this exact spot said: "If the film is ever
   re-cut, these numbers move and this array has to be regenerated with
   it — a chapter link that lands 40 seconds off is worse than no
   chapter link, because the viewer assumes they misremembered rather
   than that we were wrong." The warning was written, the film was
   re-cut, and the warning was not followed. A rule that depends on
   somebody remembering it at the right moment is not a rule.

   ⭐ So the fix is not better numbers — it is REMOVING THE THING THAT
   CAN GO STALE. A plain list of what's covered cannot drift out of sync
   with a runtime, because it does not know the runtime. Ty's call, off
   a side-by-side.

   ⚠️ And a seventeen-item clickable menu was doing the same damage as
   the "fourteen minutes" line above it: it made a three-and-a-half-minute film LOOK
   long. Chapters exist so you can skip around something you don't want
   to sit through. This is shorter than its own chapter list took to
   read.

   ⚠️ NO 'use client'. With the seek handler gone there is no state, no
   ref and no event — nothing here needs to run in the browser, so it
   doesn't ship any JS. page.jsx imports the DEFAULT export, which is
   the only import that crosses this boundary safely either way.
   ===================================================================== */

/* Plain strings, deliberately. No times, no ids, nothing to click and
   nothing that has to agree with the file in /public. */
const COVERS = [
  'Signing up, and going anonymous',
  'Your day count — and the number that never resets',
  'The wall: posting, photos, replies',
  'Chat and the Front Room',
  'Meetings you can walk into',
  'Quiet, and your own page',
];

export default function Player() {
  return (
    <>
      {/* 🔴 NO autoPlay, and no `muted` to sneak past the autoplay block.
          Somebody may open this at 2am in a house full of sleeping
          people. It is a film with a voice on it; it starts when a
          person decides it starts.

          ⚠️ preload="metadata", not "auto" — "auto" starts pulling 25MB
          the instant the page opens, on a phone, on cellular, for
          somebody who may only have come to read what's in it. */}
      <video
        className="tvid"
        src="/tour.mp4"
        controls
        playsInline
        preload="metadata"
      />

      <p className="tsec">What&apos;s in it</p>
      <ul className="tchaps">
        {COVERS.map((c) => (
          <li key={c} className="tcov">{c}</li>
        ))}
      </ul>
    </>
  );
}
