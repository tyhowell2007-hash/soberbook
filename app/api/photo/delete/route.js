import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   DELETING A PHOTO — making "delete" mean delete.

   The private bucket in 0022 was chosen for exactly this. On a public
   bucket, deleting a post leaves the image reachable forever by anyone
   who ever had the link. For somebody who posted a face and then
   panicked, "it's gone from the app but still online" is the worst
   possible outcome and the one this app has no business producing.

   ---------------------------------------------------------------------
   ⚠️ THE ORDER OF THE TWO DELETES IS THE WHOLE DESIGN

   Two things must go: the row, and the file. Either can fail. So which
   goes first is a real decision, and it comes down to which failure a
   person can live with.

     row first  → if the file delete fails, an orphaned file sits in a
                  private bucket with no row pointing at it. Nothing can
                  ask for a signed link, because permission is decided by
                  reading the row. It is invisible and harmless.

     file first → if the row delete fails, the post is still on the wall
                  with a broken image on it, and the member has been told
                  it was deleted. They now believe something false about
                  their own privacy.

   So: row first, always. The recoverable failure is the one that leaves
   a person's belief about their own data TRUE.

   (An orphan sweeper is worth writing when there's more than one member
   producing them. Noted, not built.)
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  /* ---------------------------------------------------------------
     A · REMOVE MY PROFILE PHOTO
     --------------------------------------------------------------- */
  if (body?.kind === 'avatar') {
    /* Read it from the member's OWN row. The caller does not get to say
       which file to delete — they say "mine", and the database resolves
       what that means. A route that accepted a path would be a route that
       deletes anybody's avatar for anybody who can type. */
    const { data: mine } = await supabase
      .from('profiles').select('avatar_photo').eq('id', user.id).single();

    const path = mine?.avatar_photo || null;

    const { error } = await supabase.from('profiles')
      .update({ avatar_photo: null, avatar_kind: 'emoji' })
      .eq('id', user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (path) {
      await adminClient().storage.from('avatars').remove([path]);
    }
    return NextResponse.json({ ok: true });
  }

  /* ---------------------------------------------------------------
     B · DELETE ONE OF MY POSTS, AND ITS PHOTO WITH IT
     --------------------------------------------------------------- */
  const postId = typeof body?.postId === 'string' ? body.postId : null;
  if (!postId) {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 400 });
  }

  /* Ownership comes from `is_mine` on the view, not from a column the
     caller sent. ⚠️ And note it must come from the VIEW — `authenticated`
     holds no SELECT on `posts` at all, which is why is_mine exists in the
     first place: an anonymous post has a null author_id even to the
     person who wrote it, so "did I write this" cannot be answered by
     comparing ids on the client. */
  const { data: post } = await supabase
    .from('feed_posts').select('id, is_mine, photo_url, photo_urls, video_url')
    .eq('id', postId).single();

  if (!post?.is_mine) {
    /* Same reply whether the post is somebody else's or doesn't exist.
       Two different messages here would let anyone test which post ids
       are real. */
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 404 });
  }

  /* The row first. As the MEMBER, not as the admin — so the RLS delete
     policy gets a second, independent say. Belt and braces: the check
     above could be wrong, and this one is enforced by the database. */
  /* 🔴 THE RECORD'S FILES, READ BEFORE THE ROW IS GONE.

     Deleting a post cascades the `drops` row away — and used to leave its
     audio and cover art behind forever, because this route knew about
     photo_url and video_url and nothing else. That is where tonight's
     33MB of orphans came from.

     ⚠️ READ FIRST, DELETE SECOND. Once the post is gone the drop row is
     gone with it and there is nothing left to tell us which files to
     remove. Same ordering the photos below already use.

     ⚠️ Read through feed_drops, and note this only works because it is
     the AUTHOR asking: the view returns media_path for an unreleased
     drop when p.is_mine. Anyone else gets null — which is correct, and
     also means this route can only ever clean up somebody's own files. */
  const { data: rec } = await supabase
    .from('feed_drops').select('media_path, art_path').eq('post_id', postId).maybeSingle();

  /* 🔴 AN RPC, NOT A DIRECT DELETE, AND THIS WAS A REAL OUTAGE.

     `supabase.from('posts').delete().eq('id', postId)` returned
     "permission denied for table posts" for every member, on every post.

     `authenticated` has DELETE on posts and NO SELECT — deliberately,
     because that table carries author_id on anonymous posts. But a DELETE
     whose WHERE clause reads a column needs SELECT on that column, and
     the RLS policy's USING clause (author_id = current_uid()) reads one
     too. The grant was real and unusable: the row could be deleted, but
     not FOUND.

     ⚠️ The tempting fix — grant SELECT(id, author_id) — would have worked
     today and left a loaded gun for tomorrow: RLS has no SELECT policy on
     posts, so nothing would leak NOW, but the day somebody adds one for a
     good reason, author_id becomes readable on every anonymous post and
     nothing about that change would look dangerous.

     ⭐ So: delete_my_post() (0062), a SECURITY DEFINER function that does
     the ownership test in the same statement as the delete. Same rule as
     owns_post() in 0061 — posts is write-only to members, and anything
     that needs to ASK about a post goes through a function. */
  const { data: gone, error: delErr } = await supabase
    .rpc('delete_my_post', { p_post: postId });

  /* ⚠️ The function returns FALSE rather than erroring when the post
     isn't yours — it simply doesn't match. That is not an error to
     forward, it's a 404: nothing here belongs to you. */
  if (!delErr && gone === false) {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 404 });
  }
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  /* ⚠️ post.photo_url is read from feed_posts, which returns NULL for an
     anonymous post. That is correct here rather than a bug: 0022 makes it
     impossible for an anonymous post to have a photo at all, so there is
     never anything to clean up in that case. */
  /* 🔴 EVERY photo, not just the first (0065). A post can carry ten, and
     the old line removed exactly one — leaving nine files with nothing
     pointing at them. That is precisely where Aug 23's 33MB of orphans
     came from, in a different corner of this same route.

     ⚠️ ONE remove() call, not a loop. Ten round trips means the fourth can
     fail after three succeeded, which leaves a half-cleaned post — the
     exact state this ordering exists to prevent.

     ⚠️ photo_url is included and de-duplicated rather than assumed
     redundant. The 0065 trigger keeps it equal to photo_urls[1], so it
     normally adds nothing — but if that trigger is ever dropped this line
     still cleans up, and a cleanup path should not depend on a trigger
     being alive somewhere else. */
  const photoPaths = [...new Set([
    ...(Array.isArray(post.photo_urls) ? post.photo_urls : []),
    post.photo_url,
  ].filter(Boolean))];

  if (photoPaths.length) {
    await adminClient().storage.from('post-photos').remove(photoPaths);
  }
  /* Same for video. ⚠️ If this ever silently stops working, the file is
     not left public — it's left in a private bucket with nothing
     pointing at it, invisible to everyone. That's what the sweeper is
     for, and it's why the sweeper is a tidy-up rather than a safety
     control. */
  /* The record's files. ⚠️ Both go in one remove() call — two round
     trips means the second can fail after the first succeeded, leaving
     exactly the half-cleaned state this whole change exists to prevent. */
  if (rec && (rec.media_path || rec.art_path)) {
    await adminClient().storage.from('drops')
      .remove([rec.media_path, rec.art_path].filter(Boolean));
  }

  if (post.video_url) {
    await adminClient().storage.from('post-videos').remove([post.video_url]);
  }

  return NextResponse.json({ ok: true });
}
