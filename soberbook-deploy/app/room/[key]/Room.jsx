'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   INSIDE A ROOM.

   Ty, after showing me In The Rooms: "we gotta make it easy to get in.
   And make it fun to do."

   Video is Jitsi, embedded. Sober Book owns the room, the listing and the
   rules; Jitsi only carries the picture. Nothing here leaves the app —
   that was the whole complaint about the Zoom handoff: five screens
   through somebody else's product.

   ---------------------------------------------------------------------
   ⭐ CAMERA AND MIC START OFF, AND THE NAME SCREEN IS SKIPPED.

   Those two settings are the entire "easy AND kind" trade. Skipping the
   prejoin screen is fewest taps. Starting muted and dark is what makes
   fewest taps safe — the real barrier at 11pm isn't a button, it's being
   in bed and not wanting forty people to see it. You arrive already
   hidden and turn yourself on if you want to.

   ⚠️ Do not "improve" this by enabling the prejoin screen to let people
   check themselves first. That's the extra screen we removed, and it
   solves a problem that starting-muted already solved.

   ---------------------------------------------------------------------
   ⚠️ WHAT IS DELIBERATELY NOT HERE

   No streaks, no attendance count, no "you've been to 7 meetings".
   A streak punishes the night somebody couldn't come, which is the night
   it matters most. The growing post works because it rewards showing up
   FOR SOMEBODY ELSE; a meeting streak would just be one more thing to
   fail at.

   No recording, and the toolbar has no button for it.
   ===================================================================== */

/* The toolbar, trimmed on purpose. Every button here is one somebody in a
   meeting actually reaches for. Recording, live-streaming and the invite
   dialog are absent — the first two because nothing here is ever
   recorded, the third because the way in is the Sober Book listing, not
   a link people forward. */
const TOOLBAR = [
  'microphone', 'camera', 'hangup', 'chat', 'raisehand',
  'tileview', 'participants-pane', 'settings', 'videoquality',
];

export default function Room({ roomKey, title, hostName, isMine, me }) {
  const frame = useRef(null);
  const [gone, setGone] = useState(false);
  const [people, setPeople] = useState(null);

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

  /* ⚠️ Everything after the # is Jitsi config, not a query string — that
     is how their embed takes options. `prejoinPageEnabled=false` is the
     skipped name screen; the two startWith* flags are the camera and mic
     starting off. displayName is the member's handle, never their real
     name: a handle is the name they chose for this place. */
  const cfg = [
    /* ⚠️ BOTH NAMES. Jitsi renamed this option: `prejoinPageEnabled` is
       the old one and current builds read `prejoinConfig.enabled`.
       meet.jit.si is new enough to ignore the old name, so setting only
       that one left the "Enter your name" screen up — exactly the extra
       screen this was meant to remove. Harmless to send both. */
    'config.prejoinConfig.enabled=false',
    'config.prejoinPageEnabled=false',
    /* The room's own name, so the header doesn't read out the random key. */
    `config.subject=${encodeURIComponent(title)}`,
    'config.startWithAudioMuted=true',
    'config.startWithVideoMuted=true',
    'config.disableDeepLinking=true',
    'config.disableInviteFunctions=true',
    'config.doNotStoreRoom=true',
    `config.toolbarButtons=${encodeURIComponent(JSON.stringify(TOOLBAR))}`,
    `userInfo.displayName=${encodeURIComponent(me || 'friend')}`,
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.MOBILE_APP_PROMO=false',
  ].join('&');

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
        <iframe
          ref={frame}
          title={title}
          src={`https://meet.jit.si/${encodeURIComponent(roomKey)}#${cfg}`}
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          /* ⚠️ allow-same-origin is required for Jitsi to work at all, and
             it is safe here only because meet.jit.si is a different origin
             from soberbook.app — it cannot reach this page's session. */
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
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
