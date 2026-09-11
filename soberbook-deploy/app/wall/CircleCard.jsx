'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import { whoLine, aliveLine } from '../../lib/circles';

/* =====================================================================
   ⭕ THE WAY IN, ON HOME.

   Ty, 11 Sept: "make it noticeable so people can see it."

   🔴 THAT INSTRUCTION IS THE WHOLE COMPONENT. Building the room and
   leaving it unreachable is this app's single most repeated failure —
   thirteen separate times since August: delete-your-post, the log out,
   the notification bell, the open-room card, "Say hi", the kratom room's
   missing URL. A /circle page reachable only by typing the address would
   have been the fourteenth, and the one nobody would ever report,
   because you cannot file a bug about a screen you don't know exists.

   ⚠️ It is the DARK slab on a white feed — found, not urgent. No red, no
   badge, no unread count. A circle is not a notification, and 130 members
   were promised "no nudges to come back".
   ===================================================================== */

export default function CircleCard() {
  const supa = browserClient();
  const [c, setC] = useState(undefined); // undefined = not asked yet

  useEffect(() => {
    let gone = false;
    supa.rpc('my_circle')
      .then(({ data }) => { if (!gone) setC((data || [])[0] || null); })
      /* Swallowed on purpose, same call as signMissing() and the preview
         fetch: a card that failed to load is a missing card, not a red
         error across somebody's home screen. */
      .catch(() => { if (!gone) setC(null); });
    return () => { gone = true; };
  }, []); // eslint-disable-line

  /* Nothing while loading, and nothing if this member has no circle yet.
     ⚠️ A placeholder would flash a promise at somebody we can't keep. */
  if (!c) return null;

  return (
    <Link href="/circle" className="cirq">
      <div className="cirq-top">
        <h2 className="cirq-h"><span aria-hidden="true">⭕</span> Your circle</h2>
      </div>
      <p className="cirq-sub">
        {whoLine(c)}. {aliveLine(c)}.
      </p>
      <span className="cirq-go">Go in &rsaquo;</span>
    </Link>
  );
}
