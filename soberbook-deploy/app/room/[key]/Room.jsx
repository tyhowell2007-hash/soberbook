'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   INSIDE A ROOM.

   Ty, after showing me In The Rooms: "we gotta make it easy to get in.
   And make it fun to do."

   Video is Daily, embedded. Sober Book owns the room — who may open one,
   who can see it, the count, the invites — and Daily only carries the
   picture. Nothing here leaves the app, which was the whole complaint
   about the Zoom handoff: five screens through somebody else's product.

   ---------------------------------------------------------------------
   ⚠️ THIS WAS JITSI FIRST, AND meet.jit.si CANNOT HOST THIS.

   Their public server requires a moderator to LOG IN before a room can
   start — "no moderators have yet arrived". I checked it beforehand, saw
   the join screen, and wrote "verified to need no account" into the
   migration. I never clicked Join. Testing the first hop is not testing
   the journey, and that mistake cost an evening. Do not go back to
   meet.jit.si without joining a room end to end first.

   ---------------------------------------------------------------------
   ⭐ CAMERA AND MIC START OFF, AND THERE IS NO NAME SCREEN.

   Set server-side in /api/room/ensure, not here — a config a browser can
   edit is not a guarantee. Those two settings are the "easy AND kind"
   trade: skipping the prejoin screen is fewest taps, and starting dark
   and muted is what makes fewest taps safe. The real barrier at 11pm
   isn't a button, it's being in bed.

   ---------------------------------------------------------------------
   ⚠️ WHAT IS DELIBERATELY NOT HERE

   No streaks, no attendance count, no "you've been to 7 meetings".
   A streak punishes the night somebody couldn't come, which is the night
   it matters most.

   No recording — off in the room's server-side properties, so it isn't a
   button somebody could find.
   ===================================================================== */

export default function Room({ roomKey, title, hostName, isMine, me }) {
  const [gone, setGone] = useState(false);
  const [people, setPeople] = useState(null);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');

  /* ---- get (or make) the Daily room ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/room/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomKey }),
        });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) { setErr(body.error || 'Couldn’t open the video room.'); return; }
        setUrl(body.url);
      } catch {
        if (alive) setErr('Couldn’t reach the video room.');
      }
    })();
    return () => { alive = false; };
  }, [roomKey]);

  /* ---- heartbeat ----
     Tells the database we're in here so the listing can say "3 in there
     now". ⚠️ It is also the join check: room_heartbeat() returns false
     for a closed room, so a stale link can't resurrect one. */
  useEffect(() => {
    const supabase = browserClient();
    let alive = true;
    async function beat() {
      const { data } = await supabase.rpc('room_heartbeat', { key: roomKey });
      if (!alive) return;
      if (data === false) { setGone(true); return; }
      const { data: rows } = await supabase
        .from('open_meeting_rooms').select('people').eq('room_key', roomKey).maybeSingle();
      if (alive && rows) setPeople(rows.people);
    }
    beat();
    const id = setInterval(beat, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [roomKey]);

  async function endRoom() {
    const supabase = browserClient();
    await supabase.rpc('close_meeting_room');
    window.location.assign('/meetings');
  }

  if (gone) {
    return (
      <div className="pad">
        <div className="rm-gone">
          <h2>That room has closed.</h2>
          <p>The person chairing it ended the meeting.</p>
          <Link href="/meetings" className="btn">See what else is on</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mast rm-mast">
        <Link href="/meetings" className="back" aria-label="Back to meetings">←</Link>
        <span className="lg rm-title">{title}</span>
        {people !== null && (
          <span className="rt rm-count">
            {people === 1 ? '1 here' : `${people} here`}
          </span>
        )}
      </div>

      <div className="rm-frame">
        {err ? (
          /* ⚠️ Says it plainly and offers the way out. A blank black
             rectangle at 2am reads as "even this doesn't want me". */
          <div className="rm-frameerr">
            <p>{err}</p>
            <Link href="/meetings" className="btn">Back to meetings</Link>
          </div>
        ) : url ? (
          <iframe
            title={title}
            /* ⚠️ ?userName= is how Daily takes the name without a prejoin
               screen. Without it everyone is "Guest", which in a meeting
               means nobody can tell who is speaking. */
            src={`${url}?userName=${encodeURIComponent(me || 'friend')}`}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          />
        ) : (
          <div className="rm-frameerr"><p>Opening the room…</p></div>
        )}
      </div>

      <div className="pad rm-foot">
        <p className="hint">
          You came in with your camera and microphone off. Turn them on when
          you want to. Nothing here is recorded.
        </p>
        {isMine ? (
          <button type="button" className="btn rm-end" onClick={endRoom}>
            End the meeting
          </button>
        ) : (
          <p className="hint">{hostName} is chairing.</p>
        )}
      </div>
    </>
  );
}
