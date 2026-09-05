'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   "THERE'S A WALKTHROUGH" — shown once, at the top of the wall.

   🔴 WHY IT EXISTS. 106 of 146 members have never posted or replied.
   They arrive on the wall, meet a room already mid-conversation, and
   have no idea there is a bell, an anonymous switch, a Front Room, or
   meetings. /tour explains all of it in three and a half minutes and
   nothing in the app linked to it — so the people it was built for
   could not find it.

   ⚠️ THIS CARD SAID "FOURTEEN MINUTES" UNTIL 2 SEPT, over a film that
   is 3:29. It is the first thing a new member reads about the
   walkthrough, so it was the single most expensive place in the app to
   have that number wrong — the whole job of this card is to make a
   short film feel worth starting. See app/tour/page.jsx for the full
   note.

   ⚠️ A LINK ON /me WOULD NOT HAVE WORKED. That is where somebody goes
   who already knows their way around. The person this is for never
   gets that far.

   ⚠️ "Not now" IS A REAL ANSWER AND IT IS PERMANENT. 130 members were
   emailed a promise of "no reminders, no streaks, no nudges to come
   back". A card that reappears next week is a nudge. Copied from
   PushAsk.jsx, including that rule.
   ===================================================================== */
export default function TourCard() {
  /* null = we have not heard back from the server yet. Renders NOTHING
     in that state — a card that flashes in and then vanishes on a slow
     connection is worse than one that arrives a beat late. */
  const [due, setDue] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await browserClient().rpc('tour_card_due');
      if (alive) setDue(data === true);
    })();
    return () => { alive = false; };
  }, []);

  /* ⚠️ Hide it IMMEDIATELY, then tell the server. The opposite of the
     block button, deliberately: a block that only looks like it worked
     is dangerous, so that one waits. This is a card going away — the
     worst case if the write fails is that somebody sees it once more,
     which is not worth making them watch a spinner for. */
  async function done() {
    setDue(false);
    try { await browserClient().rpc('tour_card_done'); } catch { /* see above */ }
  }

  if (due !== true) return null;

  return (
    <div className="tourcard">
      <p className="tcH">New here? There&apos;s a walkthrough.</p>
      <p className="tcP">
        Three and a half minutes on everything this does &mdash; including
        the parts most people never find.
      </p>
      <div className="tcRow">
        {/* ⚠️ Watching also dismisses it. Somebody who has seen the film
            does not need to be told about the film. */}
        <Link href="/tour" className="tcGo" onClick={done}>Watch it</Link>
        <button type="button" className="tcNo" onClick={done}>Not now</button>
      </div>
    </div>
  );
}
