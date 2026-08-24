import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   STEP 1 OF 2 — HAND THE BROWSER A DOOR, NOT A KEY.

   ---------------------------------------------------------------------
   WHY THIS ROUTE EXISTS AT ALL

   The old upload route took the file as a request body. That works right
   up to 4.5MB, at which point **Vercel** — not our code — returns
   FUNCTION_PAYLOAD_TOO_LARGE. It is an infrastructure limit and no
   config changes it.

   Our route advertised 15MB. So every phone photo between 4.5 and 15MB
   has been failing since the feature shipped, with an error that doesn't
   say why. Found by asking "can we do video", which is a good argument
   for asking awkward questions about things that seem finished.

   ---------------------------------------------------------------------
   ⚠️ WHY THIS ISN'T "GIVING THE BROWSER STORAGE ACCESS"

   0022 gave the browser NO storage permissions, deliberately, so the
   metadata strip could not be skipped. This does not walk that back.

   A signed upload URL is not a key to the bucket. It is permission to
   PUT one file, at one path THIS SERVER chose, once. The browser cannot
   list, cannot read, cannot overwrite, and cannot pick where anything
   lands.

   And it lands in `quarantine`, which nothing is ever served from. The
   file is not viewable by anyone — including the person who uploaded it
   — until the finalize step has stripped it and moved it. The strip is
   still not optional; it just happens after the bytes arrive instead of
   during.

   ---------------------------------------------------------------------
   ⚠️ THE USER ID IS IN THE PATH, AND THAT IS THE SECURITY

   `<user_id>/<uuid>.<ext>`. Finalize refuses any path that doesn't begin
   with the caller's own id. Without that, anyone could hand finalize
   somebody else's quarantined file and promote it into their own post —
   a stranger's photo, published under your name, from a single guessed
   string. The id in the path is what makes that impossible.
   ===================================================================== */

const KINDS = {
  post:   { ext: 'bin' },
  avatar: { ext: 'bin' },
  /* A member's own record (0058). Same quarantine road as everything
     else — the file lands somewhere nothing is served from, and finalize
     decides what it really is by reading the bytes. */
  drop:   { ext: 'bin' },
  dropart:{ ext: 'bin' },
};

/* What the browser is allowed to say it's sending. ⚠️ This is a HINT, not
   a check — a caller can claim anything. The real decision is made in
   finalize, which looks at the actual bytes. This list exists only to
   fail fast and politely on the obvious cases. */
const OK_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
  /* Audio, for drops. ⚠️ Browsers disagree wildly on what an .m4a is —
     Safari says audio/mp4, Chrome says audio/x-m4a, some Android pickers
     say octet-stream. All three are here because this list only exists to
     fail fast; finalize reads the actual bytes either way. */
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  /* ⚠️ WebM is deliberately NOT here. It's a different container with a
     different metadata format, and lib/strip-video.js doesn't understand
     it — so we'd be publishing a file we never actually cleaned. Phones
     don't record WebM, so nothing real is lost.

     Some Android pickers hand over octet-stream for a genuine MP4, so
     this list can't be the decision. Finalize reads the bytes. */
  'application/octet-stream',
]);

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const kind = KINDS[String(body?.kind || '')];
  const type = String(body?.contentType || '');

  if (!kind) {
    return NextResponse.json({ error: 'Unknown upload kind.' }, { status: 400 });
  }
  if (!OK_TYPES.has(type)) {
    return NextResponse.json(
      { error: "That kind of file can't be posted here." }, { status: 415 });
  }

  /* crypto.randomUUID(), never a counter and never anything derived from
     the person. A predictable path is a browsable one. */
  const path = `${user.id}/${crypto.randomUUID()}`;

  const { data, error } = await adminClient()
    .storage.from('quarantine')
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json(
      { error: "Couldn't start that upload. Try again." }, { status: 500 });
  }

  /* `token` is what the browser passes to uploadToSignedUrl. It is scoped
     to this one path and expires on its own. */
  return NextResponse.json({ path: data.path, token: data.token });
}
