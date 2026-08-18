import { adminClient, adminConfigured } from './supabase-admin';

/* =====================================================================
   TURNING STORED PATHS INTO LINKS A BROWSER CAN LOAD.

   ⚠️ SERVER ONLY. It reaches for the service role via adminClient().

   This lives in lib rather than inside the API route because it has two
   callers: the route (for the client re-fetching after a post) and the
   Wall's server component (for the first render). Written twice, the two
   copies drift, and the one that drifts into being too permissive is the
   one nobody is reading.

   The permission rule is in ONE place and it is not in this file — see
   the long note in app/api/photo/sign/route.js. Short version: the
   caller's own session queries the views, the views already know about
   blocks and anonymity and suspension, and only what comes back gets
   signed.
   ===================================================================== */

const TTL = 3600;
const MAX = 60;

export async function signPhotoPaths(supabase, wanted) {
  /* No key, no signed links — but the page still renders. See the note on
     adminConfigured(). A wall with no pictures is a working wall; a wall
     that 500s is not. */
  if (!adminConfigured()) return {};

  const asked = [...new Set((wanted || []).filter(Boolean))].slice(0, MAX);
  if (asked.length === 0) return {};

  /* ⚠️ THE PREFIX IS THE ROUTING, and that's deliberate. The stored value
     says which bucket it lives in and which view is allowed to vouch for
     it. The caller never names a bucket — if it could, "sign me this
     path, from post-videos" becomes a way to ask the wrong gatekeeper. */
  const postPaths   = asked.filter((p) => p.startsWith('posts/'));
  const avatarPaths = asked.filter((p) => p.startsWith('avatars/'));
  const videoPaths  = asked.filter((p) => p.startsWith('videos/'));

  const allowed = new Set();

  if (postPaths.length) {
    const { data } = await supabase
      .from('feed_posts').select('photo_url').in('photo_url', postPaths);
    (data || []).forEach((r) => r.photo_url && allowed.add(r.photo_url));
  }

  /* Same question, same view, different column. `feed_posts.video_url` is
     already NULL on an anonymous post and the whole row is already gone
     if either person blocked the other — so a video inherits every rule a
     photo has, for free, because we asked instead of deciding. */
  if (videoPaths.length) {
    const { data } = await supabase
      .from('feed_posts').select('video_url').in('video_url', videoPaths);
    (data || []).forEach((r) => r.video_url && allowed.add(r.video_url));
  }

  if (avatarPaths.length) {
    const { data } = await supabase
      .from('public_profiles')
      .select('display_avatar_photo').in('display_avatar_photo', avatarPaths);
    (data || []).forEach((r) =>
      r.display_avatar_photo && allowed.add(r.display_avatar_photo));
  }

  const admin = adminClient();
  const urls = {};

  for (const [bucket, prefix] of [['post-photos', 'posts/'],
                                  ['avatars',     'avatars/'],
                                  ['post-videos', 'videos/']]) {
    const paths = [...allowed].filter((p) => p.startsWith(prefix));
    if (!paths.length) continue;
    const { data } = await admin.storage.from(bucket).createSignedUrls(paths, TTL);
    (data || []).forEach((r) => { if (r.signedUrl) urls[r.path] = r.signedUrl; });
  }

  return urls;
}

/* Every photo path on a page, gathered in one pass so the whole screen
   costs ONE signing round trip instead of one per picture. At four
   members that is a rounding error; at four hundred it is the difference
   between a page that loads and a page that hangs. Cheap to write now,
   annoying to retrofit later. */
export function collectPaths(rows) {
  const out = [];
  for (const r of rows || []) {
    if (r.photo_url)            out.push(r.photo_url);
    if (r.video_url)            out.push(r.video_url);
    if (r.display_avatar_photo) out.push(r.display_avatar_photo);
  }
  return out;
}
