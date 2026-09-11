import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { streamReady, playerUrl, videoState } from '../../../../lib/cloudflare-stream';
import { mayWatch } from '../../../../lib/stream-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   THE ONLY WAY TO WATCH ANYTHING.

   Every video on Cloudflare is created with requireSignedURLs: true, so a
   bare video id is worth nothing — their words: "it can no longer be
   accessed publicly with only the video id." This route is what turns an
   id into a URL that plays, and it refuses unless the CALLER'S OWN
   SESSION can see a row carrying that id.

   ⭐ It decides nothing itself. lib/stream-access.js asks the four views,
   and the views already know about anonymity, blocks, suspension,
   declined threads, deleted rooms and post audience. Same stance as
   app/api/photo/sign — the permission rule lives in ONE place and it is
   not in an API route.

   ⚠️ A token lasts an hour and is minted on TAP, not on render. Nothing
   about a video reaches Cloudflare until a member decides to watch — the
   23 Aug rule about embeds, which exists because an iframe that loads on
   scroll announces a member's browser to a third party before they have
   chosen anything.

   🔴 The refusal is deliberately vague and IDENTICAL whether the id is
   unknown, hidden from you, or malformed. A distinguishable "no such
   video" is a way to test whether an id exists, which is the same mistake
   report_member() and block_member() were written to avoid (0090).
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

  const ok = await mayWatch(supabase, uid);
  if (!ok) {
    return NextResponse.json({ error: "That video isn't available." }, { status: 404 });
  }

  try {
    /* ⚠️ Ask whether it has finished transcoding BEFORE minting a token.
       A just-uploaded video returns a perfectly valid token and then a
       black rectangle, which reads as "this app is broken" rather than
       "give it a minute". Saying so is cheaper than a support email. */
    const st = await videoState(uid);
    if (!st.ready) {
      return NextResponse.json(
        { pending: true, state: st.state }, { status: 202 });
    }
    const src = await playerUrl(uid);
    return NextResponse.json({ src });
  } catch (e) {
    return NextResponse.json(
      { error: `That video wouldn't open — ${e.message}` }, { status: 502 });
  }
}
