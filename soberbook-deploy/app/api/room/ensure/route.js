import { NextResponse } from 'next/server';
import { serverClient, assertReadable } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

/* =====================================================================
   MAKE SURE THE DAILY ROOM EXISTS, AND HAND BACK ITS URL.

   Sober Book owns the room — who may open one (90 days), who can see it,
   the count, the invites. Daily only carries the picture. This route is
   the one seam between the two.

   ---------------------------------------------------------------------
   🔴 THE KEY NEVER REACHES A BROWSER.

   DAILY_API_KEY has no NEXT_PUBLIC_ prefix, so Next.js will not ship it
   to the client — the same rule as SUPABASE_SERVICE_ROLE_KEY. If anybody
   ever adds that prefix "to make it work", the key is world-readable in
   the page source of a recovery app.

   🔴 AND THIS ROUTE CANNOT BE USED TO MINT ARBITRARY ROOMS.

   It looks the key up in open_meeting_rooms FIRST. That view only
   contains rooms that are open, hosted by somebody not suspended, and
   not run by anyone either of you has blocked. No row → 404, and no
   Daily room is created. Without that check, any signed-in member could
   spin up unlimited rooms on Ty's paid account.
   ===================================================================== */

/* ⚠️ COST CONTROL, AND IT MATTERS MORE THAN USUAL HERE.
   Daily is pay-as-you-go with NO spending cap — their own FAQ says
   "there is no hard cap that stops your calls." A room left open
   overnight with one forgotten tab bills for every one of those minutes.
   So every room is created with an expiry and ejects people at it.
   4 hours is far longer than any meeting and far shorter than a night. */
const ROOM_HOURS = 4;

export async function POST(request) {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    /* ⚠️ Says WHICH thing is missing, because the alternative is an
       afternoon wondering why rooms 500. It names an env var, not a
       secret. */
    return NextResponse.json(
      { error: 'Video isn’t set up yet — DAILY_API_KEY is missing.' },
      { status: 503 },
    );
  }

  let roomKey;
  try {
    ({ roomKey } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!roomKey || typeof roomKey !== 'string') {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  /* THE authorisation check. See the note at the top. */
  const { data: room } = await supabase
    .from(assertReadable('open_meeting_rooms'))
    .select('room_key, title')
    .eq('room_key', roomKey)
    .maybeSingle();

  if (!room) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const props = {
    /* Straight in — no name screen. The Sober Book page already knows
       who you are. */
    enable_prejoin_ui: false,
    /* ⭐ Camera and mic OFF. The whole "easy AND kind" trade: fewest taps
       is only safe if arriving doesn't put somebody on camera in bed. */
    start_video_off: true,
    start_audio_off: true,
    /* 🔴 Nothing is ever recorded, and there is no button for it. */
    enable_recording: false,
    enable_chat: true,
    enable_screenshare: true,
    /* People can knock but the room doesn't hold them — a lobby with two
       members in it is a locked door nobody is behind. Revisit if the
       room ever gets big. */
    enable_knocking: false,
    exp: Math.floor(Date.now() / 1000) + ROOM_HOURS * 3600,
    eject_at_room_exp: true,
  };

  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  /* Already there? Use it. Daily keeps the room until `exp`, so a second
     person arriving five minutes later joins the SAME room rather than
     making a new one next to it. */
  const existing = await fetch(`https://api.daily.co/v1/rooms/${roomKey}`, { headers });
  if (existing.ok) {
    const r = await existing.json();
    return NextResponse.json({ url: r.url });
  }

  const made = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: roomKey, privacy: 'public', properties: props }),
  });

  if (!made.ok) {
    /* ⚠️ Log the real reason server-side; tell the member something true
       and useless to an attacker. Daily's errors quote account details. */
    console.error('daily room create failed', made.status, await made.text());
    return NextResponse.json({ error: 'Couldn’t open the video room.' }, { status: 502 });
  }

  const r = await made.json();
  return NextResponse.json({ url: r.url });
}
