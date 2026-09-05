'use client';

import { useState } from 'react';
import Room from './Room';

/* =====================================================================
   WHICH ROOM YOU ARE IN.

   Ty, 30 Aug, after a member asked on Dr. Nicole Labor's page whether
   there was "anything like this for family of addicts": open a second
   room, The Front Porch (0097).

   ---------------------------------------------------------------------
   ⭐ A SWITCHER, NOT TWO ROOMS STACKED — AND THE REASON IS THE FIRST DAY.

   0092 argued against a second room because several rooms at eighteen
   members means several EMPTY rooms, and an empty room says "this place
   is dead" louder than no room at all. That argument was right and it
   still applies.

   Stacked, the first thing a frightened parent sees on arriving is a room
   with nobody in it — which is precisely the feeling that brought them.
   Behind a tab, they CHOOSE to open it, and an empty room you opened on
   purpose reads completely differently from one put in front of you.

   ⚠️ So this is not a compromise between the two layouts. It is how you
   get a second room without paying 0092's price.

   ---------------------------------------------------------------------
   ⚠️ ONE TAB IS NOT A TAB BAR. With a single room the strip is hidden
   entirely rather than drawn with one item — a lone tab is a control that
   does nothing, and controls that do nothing teach people to stop
   tapping. It appears when there is somewhere else to go.

   ⚠️ `key={active.id}` REMOUNTS Room on every switch, deliberately. Room
   holds a poll timer, a draft message, a photo tray and a scroll
   position, all of which belong to ONE conversation. Letting React reuse
   the instance would carry a half-typed sentence from the Front Room into
   the Porch — which, in a room where the whole point is that the two
   audiences are separate, is the worst possible bug.
   ===================================================================== */

export default function RoomSwitch({ rooms, first, firstMessages, meHandle,
                                     members, signed, spokenHere }) {
  const [activeId, setActiveId] = useState(first.id);
  const active = rooms.find((r) => r.id === activeId) || first;
  const isFirst = active.id === first.id;

  return (
    <>
      {rooms.length > 1 && (
        <div className="rtabs" role="tablist" aria-label="Rooms">
          {rooms.map((r) => (
            <button key={r.id} type="button" role="tab"
                    aria-selected={r.id === activeId}
                    className={'rtab' + (r.id === activeId ? ' on' : '')}
                    onClick={() => setActiveId(r.id)}>
              <span aria-hidden="true">{r.emoji}</span> {r.name.replace(/^The /, '')}
            </button>
          ))}
        </div>
      )}

      <Room
        key={active.id}
        room={active}
        /* ⚠️ null, not [] — and the difference is load-bearing. An empty
           array means "this room has no messages", which Room would
           render as its empty state. null means "nobody has fetched yet",
           and Room goes and gets them. Passing [] here would show every
           room but the first as permanently empty. */
        initial={isFirst ? firstMessages : null}
        signed={isFirst ? signed : {}}
        /* The nudge is only meaningful where we actually checked. In a
           room we haven't looked at yet, Room works it out from what
           comes back rather than being told something we don't know. */
        spokenHere={isFirst ? spokenHere : null}
        meHandle={meHandle}
        members={members}
      />
    </>
  );
}
