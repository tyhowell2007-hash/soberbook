import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { streamReady, videoState } from '../../../../lib/cloudflare-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   "HAS MY UPLOAD FINISHED ENCODING YET?" — AND ONLY MINE.

   🔴 THIS ROUTE EXISTS BECAUSE OF A BUG CAUGHT BEFORE IT SHIPPED, AND IT
   IS WORTH WRITING DOWN BECAUSE THE FIRST VERSION LOOKED CORRECT.

   The composer polled /api/video/token while waiting. That route answers
   "may this person watch this?" by asking the four views — and in the
   window between the upload finishing and the member pressing Post, NO
   ROW ANYWHERE carries the uid. So the honest answer was no, the poll got
   a 404 on its first try, and the composer would have given up instantly
   on every single video. Both halves were behaving exactly as written.

   ⭐ The fix is not to loosen the permission check. It is to notice these
   are two different questions: "may I watch this" is about a POST, and
   "did my own upload finish" is about an UPLOAD. Answering the second
   through the machinery built for the first is what produced a check that
   could only ever say no.

   ⚠️ So ownership here is established by the one thing that exists in
   that window: the `creator` we wrote into Cloudflare's own metadata when
   we minted the upload URL. It is compared against the caller's id, and a
   mismatch gets the same flat refusal as an unknown id — otherwise this
   becomes a way to test whether a video id is real.

   🔴 It returns a STATE and nothing else. No playback token, no URL, no
   duration, no thumbnail. A member waiting on their own encode does not
   need to be able to watch anything, and the smallest possible answer is
   the one that cannot be turned into something else.
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  if (!streamReady()) {
    return NextResponse.json({ error: 'video-not-configured' }, { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }
  const uid = String(body?.uid || '');
  if (!/^[a-f0-9]{32}$/.test(uid)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const st = await videoState(uid);
    if (st.creator !== user.id) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    return NextResponse.json({ ready: st.ready, state: st.state });
  } catch {
    /* ⚠️ An error is NOT "ready". The composer treats anything that is not
       an explicit yes as "keep waiting, then post anyway" — which is the
       direction that cannot lose somebody's work. */
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
}
