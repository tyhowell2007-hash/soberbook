import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { streamReady, directUploadUrl } from '../../../../lib/cloudflare-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   A ONE-TIME DOOR FOR A VIDEO — ANY VIDEO.

   The photo road (quarantine → strip → promote) is ours end to end and
   works beautifully for anything a BROWSER can read. Video broke that
   assumption on 10 Sept: the shrinker runs in the browser, and no browser
   decodes ProRes, DNxHD, or half of what an editor exports. So a member
   with a finished piece of work hits a wall our own code cannot move.

   Cloudflare transcodes anything ffmpeg understands. This route hands the
   browser permission to PUT one file, once, to a URL Cloudflare issued —
   exactly the same shape as app/api/photo/upload-url, and for the same
   reason: the file never passes through Vercel, which has a hard 4.5MB
   body limit nothing can configure away.

   🔴 WHAT THIS GIVES UP, AND WHY IT IS ACCEPTABLE.
   Our own video path strips GPS out of the container before anything is
   served (lib/strip-video.js, 0029). A file going to Cloudflare is not
   stripped by us — but it is TRANSCODED by them, start to finish, into
   new HLS segments. The original container, and every `©xyz` / `loci` box
   in it, is not what gets served. Nobody is ever handed the file that was
   uploaded. ⚠️ That is a different mechanism reaching the same place, not
   a relaxation — and it is the only mechanism available for a format the
   browser cannot open.

   ⚠️ maxDurationSeconds is a COST CEILING, not a taste judgement. Stream
   bills by duration, so an accidental two-hour screen recording is a real
   bill. Twelve minutes is comfortably more than the eleven the browser
   shrinker could manage, so nobody loses anything they had before.
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  /* ⚠️ Degrade honestly. If the account is not wired up yet, say so
     plainly and let the caller fall back to the old Supabase road rather
     than throwing a 500 at somebody holding a phone. The browser reads
     this exact flag to decide. */
  if (!streamReady()) {
    return NextResponse.json({ error: 'video-not-configured' }, { status: 503 });
  }

  try {
    const { uid, uploadURL } = await directUploadUrl({
      maxDurationSeconds: 720,
      creator: user.id,
    });
    return NextResponse.json({ uid, uploadURL });
  } catch (e) {
    /* Cloudflare's own words come through cf(). "Out of storage" and
       "bad token" need completely different things from Ty, and flattening
       them into one sentence is how 8 Sept got spent guessing. */
    return NextResponse.json(
      { error: `Couldn't start that upload — ${e.message}` }, { status: 502 });
  }
}
