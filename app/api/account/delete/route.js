import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   LEAVING — the server half.

   The database does the rows (0032). This does the three things SQL
   can't reach: the files in storage, the login itself, and the order
   they happen in.

   ---------------------------------------------------------------------
   ⚠️ THE ORDER IS THE DESIGN, and it is not the obvious one.

     1 · read the list of their files          ← BEFORE anything is gone
     2 · delete the rows                        (the RPC)
     3 · delete the files
     4 * delete the login

   Step 1 has to come first because the only record of which files
   belong to this person IS the rows. Delete the rows first and the
   photos become unreachable orphans nobody can identify — still sitting
   in a bucket, belonging to someone who thinks they left.

   Step 4 has to come last. If the login were destroyed first and
   anything after it failed, the person could never sign back in to
   finish the job — locked out of an account that still holds their
   posts. Every failure mode in this order leaves them able to try
   again.

   ⚠️ And if step 3 fails, nothing is broken: the files are in private
   buckets with no row pointing at them, invisible to everyone, and the
   orphan sweeper collects them within 24 hours. That is exactly what
   the sweeper was built for.
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const keepAnonymous = body?.keepAnonymous === true;
  const typed = String(body?.confirm || '').trim();

  /* ---- who they are, and everything of theirs that is a file ------- */
  const { data: me } = await supabase
    .from('profiles')
    .select('handle, avatar_photo')
    .eq('id', user.id)
    .single();

  if (!me) {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 404 });
  }

  /* ⚠️ TYPE YOUR OWN HANDLE TO CONFIRM. Not a checkbox, not a second
     "are you sure" — both of those are muscle memory by the third tap.
     Typing your own name is the cheapest thing that cannot be done by
     accident, and this is the one action in the app with no undo.

     Case-insensitive: making somebody match capitalisation on a phone
     keyboard is a puzzle, not a safeguard. */
  if (typed.toLowerCase() !== String(me.handle).toLowerCase()) {
    return NextResponse.json(
      { error: `Type ${me.handle} exactly to confirm.` }, { status: 400 });
  }

  /* Their posts' media. Read through feed_posts as themselves, so this
     sees precisely what they own and nothing else. */
  const { data: mine } = await supabase
    .from('feed_posts')
    .select('photo_url, video_url')
    .eq('is_mine', true);

  const photos = [];
  const videos = [];
  for (const r of mine || []) {
    if (r.photo_url) photos.push(r.photo_url);
    if (r.video_url) videos.push(r.video_url);
  }
  const avatars = me.avatar_photo ? [me.avatar_photo] : [];

  /* ---- 2 · the rows ------------------------------------------------
     Called as the MEMBER, not as the admin. The function reads
     current_uid() and has no user-id parameter, so a session is the
     only thing that can aim it — and it can only ever aim at itself. */
  const { data: result, error: rpcErr } = await supabase
    .rpc('delete_my_account', { p_keep_anonymous: keepAnonymous });

  if (rpcErr) {
    return NextResponse.json(
      { error: 'Something went wrong. Nothing was deleted — try again.' },
      { status: 500 });
  }

  /* ---- 3 · the files ----------------------------------------------- *
     Best effort by design. A failure here costs storage, not privacy:
     nothing points at these any more, so nobody can see them, and the
     sweeper takes them inside a day. Failing the whole request over it
     would leave the person's rows gone and their account still live,
     which is worse in every way. */
  if (adminConfigured()) {
    const admin = adminClient();
    try {
      if (photos.length)  await admin.storage.from('post-photos').remove(photos);
      if (videos.length)  await admin.storage.from('post-videos').remove(videos);
      if (avatars.length) await admin.storage.from('avatars').remove(avatars);
    } catch { /* the sweeper will get them */ }
  }

  /* ---- 4 · the login ------------------------------------------------
     Last, and this is the step that makes it a deletion rather than a
     tidy-up. Until this runs the person can still sign in.

     ⚠️ Needs the service role — a member cannot delete their own auth
     user from the browser, and that's correct: it would be an
     irreversible action available to anything that got hold of a
     token. */
  if (adminConfigured()) {
    try { await adminClient().auth.admin.deleteUser(user.id); }
    catch { /* fall through — the rows are already gone */ }
  }

  /* Clear the cookie on the way out so the browser isn't left holding a
     session for an account that no longer exists. */
  try { await supabase.auth.signOut(); } catch {}

  return NextResponse.json({
    ok: true,
    mode: result?.mode || (keepAnonymous ? 'keep_anonymous' : 'everything'),
    postsRemoved: result?.posts_removed ?? 0,
    anonymousKept: result?.anonymous_kept ?? 0,
  });
}
