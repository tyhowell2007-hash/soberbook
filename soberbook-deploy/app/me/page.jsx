import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../lib/supabase-admin';
import { signPhotoPaths } from '../../lib/sign-photos';
import Me from './Me';

export const dynamic = 'force-dynamic';

/* Your own page. Deliberately small.

   NOT here, on purpose: themes, anthem, sponsor status, milestone chips,
   and other people's profiles. Every one of those is a good idea and every
   one of them would have delayed the sign-out button, which is a promise
   already made to 12 people. Ship the promise first. */
export default async function MePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, display_name, sober_since, date_prompt_off, privacy_mode, created_at, anthem_url, anthem_title, anthem_art, anthem_preview, anthem_youtube, autoplay_songs, lifetime_days, show_lifetime, bio, town, state, show_location, programs, interests, sponsor_status, avatar, avatar_kind, avatar_photo, findable_by_name')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/welcome');

  /* ---- your own face, signed ----
     ⚠️ Signed DIRECTLY rather than through signPhotoPaths(), and the
     reason is a bug I would otherwise have shipped.

     signPhotoPaths asks `public_profiles` whether a photo may be shown.
     That view nulls display_avatar_photo for anyone in anonymous mode —
     correctly, because an anonymous member has no public face. But this
     page is not the public view. Routed through it, an anonymous member
     would open their own settings and find their photo apparently gone,
     with no way to tell whether it had been deleted.

     The authorisation here is simpler and stronger than the view's: the
     path came out of their OWN row, read a moment ago with their OWN
     session. There is nobody else's photo it could possibly be. */
  let initialAvatarUrl = null;
  if (profile.avatar_photo && adminConfigured()) {
    const { data: signed } = await adminClient()
      .storage.from('avatars').createSignedUrl(profile.avatar_photo, 3600);
    initialAvatarUrl = signed?.signedUrl || null;
  }

  /* Your own posts — WITHOUT ever asking the database "whose posts are
     these?". `is_mine` is computed inside the view by comparing author_id
     to auth.uid() and is the only ownership signal that ever reaches a
     browser. So this returns your anonymous posts too, and still never
     tells the client who wrote them.

     Doing this the obvious way — .eq('author_id', user.id) on the posts
     table — would work, and would quietly hand the browser the exact
     column the whole anonymity design exists to withhold. */
  const { data: mine } = await supabase
    .from(assertReadable('feed_posts'))
    .select('id, body, photo_url, photo_urls, video_url, created_at, is_anonymous, comment_count')
    .eq('is_mine', true)
    .order('created_at', { ascending: false })
    .limit(50);

  /* Your own posts, with their pictures. Signed here on the server for the
     same reason the Wall does it: the list arrives whole rather than
     popping images in afterwards. */
  /* Photos AND videos, in one signing pass. flatMap not map: a post
     contributes zero, one or two paths and Boolean() drops the nulls. */
  const postPhotoUrls = await signPhotoPaths(
    supabase,
    /* ⚠️ Spread photo_urls in (0065). */
    (mine || []).flatMap((p) => [
      ...(Array.isArray(p.photo_urls) ? p.photo_urls : []), p.photo_url, p.video_url,
    ]).filter(Boolean));

  /* Who got back to you. ⚠️ Read from the VIEW, never the table — the view
     is what turns an anonymous replier into the word "Someone" and drops
     their id entirely. Selecting from `notifications` here would hand the
     browser actor_id and undo 0025 in one line. */
  const { data: notes } = await supabase
    .from('my_notifications')
    .select('id, kind, who, who_handle, about, post_id, unread, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  /* Tags waiting on you (0082).

     ⚠️ Through the function, never a table read — my_pending_tags() takes
     no argument, so it can only ever return the caller's own. There is no
     shape of this call that returns somebody else's pending tags.

     ⭐ It lives on /me rather than a page of its own because this is the
     one screen that is already about you and nobody else. */
  const { data: pending } = await supabase.rpc('my_pending_tags');

  return (
    <Me
      email={user.email}
      profile={profile}
      posts={mine || []}
      initialAvatarUrl={initialAvatarUrl}
      postPhotoUrls={postPhotoUrls}
      pendingTags={pending || []}
      notes={notes || []}
    />
  );
}
