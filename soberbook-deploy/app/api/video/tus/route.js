import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { streamReady, tusCreate } from '../../../../lib/cloudflare-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   THE BIG-FILE DOOR.

   🔴 WHY THIS EXISTS, AND IT IS A MISTAKE I MADE. The basic POST road
   built earlier tonight is capped at 200MB — Cloudflare's own decision
   chart says "Is the video over 200 MB? → Yes → You must use the tus
   protocol." Ty's ProRes trailer is 243MB. It uploaded to 100%, then
   came back 413, because all the bytes arrive before the size is judged.

   ⭐ And 100% then failing is the cruellest possible shape: it looks like
   the app broke at the finish line rather than like a rule. He watched
   that happen twice before I read the right page.

   ⚠️ THE HANDSHAKE IS ALL IN HEADERS, WHICH IS WHY THIS ROUTE EXISTS AT
   ALL RATHER THAN THE BROWSER CALLING CLOUDFLARE DIRECTLY:
     · we send Tus-Resumable / Upload-Length / Upload-Metadata
     · the upload URL comes back in the **Location** response header
     · the video id comes back in **stream-media-id** — and their docs say
       explicitly: do NOT parse the id out of the Location URL, read the
       header. So that is what we do.
   The API token stays here, exactly as on the small-file road.
   ===================================================================== */

/* 🔴 THE LOCK TRAVELS WITH IT. `requiresignedurls` is a VALUELESS key in
   Upload-Metadata — its mere presence is what makes the video private.
   Forget it on this road and every video over 200MB is public to anyone
   holding the id, while every video under 200MB stays locked. That is the
   worst kind of bug: a safety rule that holds for the small case you test
   and silently lapses for the big one you don't. */

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
  const size = Number(body?.size);
  const name = String(body?.name || 'video');

  /* ⚠️ Upload-Length is REQUIRED by tus at create time, so the browser has
     to tell us the size up front. Refuse anything that isn't a plausible
     number rather than passing junk to Cloudflare and relaying a confusing
     error back. 30GB is their hard ceiling. */
  if (!Number.isFinite(size) || size <= 0 || size > 30 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "That file size doesn't look right." }, { status: 400 });
  }

  try {
    const { uploadURL, uid } = await tusCreate({
      size,
      name,
      creator: user.id,
      maxDurationSeconds: 720,
    });
    return NextResponse.json({ uploadURL, uid });
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't start that upload — ${e.message}` }, { status: 502 });
  }
}
