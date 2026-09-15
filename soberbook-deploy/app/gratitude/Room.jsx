'use client';

import { useState } from 'react';
import Gratitude from '../components/Gratitude';
import GratitudeWall from '../components/GratitudeWall';

/* =====================================================================
   /gratitude - your line, then everybody's.  15 Sept.

   ⚠️ THIS EXISTS FOR ONE REASON AND IT IS NOT DECORATION: page.jsx is a
   SERVER component, and the card and the wall need to share one piece of
   state - "your line just changed, redraw". A server component cannot
   hold that. So the two client components get one client parent, and the
   parent holds nothing except the key.

   ⚠️ IT ADDS NO RULE OF ITS OWN. Everything about what gratitude IS lives
   in Gratitude.jsx and in migration 0154; this file only decides what
   sits above what. If logic starts collecting here, it is a third copy of
   something that already exists twice.

   🔴 YOUR LINE IS ABOVE THE WALL, ALWAYS. Somebody who came here to add
   one thing should meet the box, not two hundred other people's answers.
   That ordering is the same call the check-in page made on 7 Sept, and
   for the same reason: reading the room first turns a thirty-second
   action into a decision about what is good enough to put up.
   ===================================================================== */

export default function GratitudeRoom() {
  const [key, setKey] = useState(0);
  return (
    <>
      {/* wallLink={false}: this page IS the wall, so a link to it would
          point at itself. */}
      <Gratitude wallLink={false} onChanged={() => setKey((k) => k + 1)} />
      <h2 className="gr-wall-head">Today, from everybody</h2>
      <GratitudeWall refreshKey={key} />
    </>
  );
}
