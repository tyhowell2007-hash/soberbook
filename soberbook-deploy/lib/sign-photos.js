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

/* =====================================================================
   🔴 REUSE THE SIGNED URL. A FRESH ONE EVERY RENDER IS UNCACHEABLE.

   Found Aug 26 while chasing a Supabase "exceeding usage limits" warning.

   createSignedUrls() mints a NEW token every time it's called, so the same
   photo came back as a different URL on every single wall load. A browser
   cannot use its cache for a URL it has never seen — so every member
   re-downloaded every avatar, every post photo and every video header,
   from Supabase, every time they opened Home. Nothing was ever served
   from cache. Not once.

   ⭐ The content cards already got this right by accident: their
   thumbnails come from a PUBLIC bucket, so the URL is stable and the
   browser caches it forever. That's the behaviour we want — without
   making these buckets public, because private is the whole point (0022:
   no client policies at all, GPS destroyed server-side).

   ⚠️ THE TTL IS DELIBERATELY UNCHANGED. The obvious "fix" is a longer
   expiry, and it's the wrong one: a signed URL is a capability, and
   anybody who gets hold of one can open a member's photo until it
   expires. An hour is the exposure Ty already accepted. This changes how
   OFTEN we mint them, not how long they last.

   ⚠️ In-memory, so it dies with the serverless instance and is never a
   source of truth — a miss just costs one signing call, which is what
   happened on every request before. It cannot serve a URL to somebody who
   shouldn't have one either: permission is decided BEFORE this point, by
   the views, and only paths already in `allowed` ever reach here.
   ===================================================================== */
const SIGN_CACHE = new Map();          // path -> { url, until }

/* ⚠️ Retired well before the token actually expires. A URL handed out at
   the last second would be useless by the time the picture loaded. */
const REUSE_MS = (TTL - 600) * 1000;   // 50 minutes of a 60 minute token

function cachedUrl(path) {
  const hit = SIGN_CACHE.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  if (hit) SIGN_CACHE.delete(path);
  return null;
}

function remember(path, url) {
  /* Bounded, so a long-lived instance can't grow forever. Oldest out
     first — Map keeps insertion order. */
  if (SIGN_CACHE.size > 2000) {
    for (const k of SIGN_CACHE.keys()) { SIGN_CACHE.delete(k); if (SIGN_CACHE.size <= 1500) break; }
  }
  SIGN_CACHE.set(path, { url, until: Date.now() + REUSE_MS });
}

/* ⚠️ RAISED FROM 60 WHEN POSTS COULD CARRY TEN PHOTOS (0065).

   A wall renders up to 60 posts. At one photo each, 60 was plenty. At ten
   each it is a tenth of what a full page can ask for — and the failure is
   the bad kind: `.slice()` drops the overflow silently, so pictures would
   simply not appear, with no error anywhere to notice.

   ⚠️ It is still a cap, not a promise. It bounds one signing request so a
   crafted page can't ask us to mint ten thousand URLs. If a page ever
   legitimately needs more than this, the fix is to sign per-post on
   demand — not to delete the number. */
const MAX = 400;

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
  const dropPaths   = asked.filter((p) => p.startsWith('drops/'));

  const allowed = new Set();

  /* A post's photos (0065). Same question as before, asked of the same
     view — only the shape of the column changed.

     ⚠️ `.in('photo_url', …)` CANNOT WORK against an array column: it tests
     whether the whole array equals one of the listed values. `.overlaps()`
     is the array version — "return rows whose photo_urls share at least one
     entry with this list" — which is precisely the question being asked.

     🔴 AND THEN INTERSECT WITH WHAT WAS ASKED FOR. `.overlaps()` hands back
     the ENTIRE array of every matching post, including photos the caller
     never mentioned. Adding those wholesale would not leak anything — if
     the post is visible, so are all its pictures — but it would sign files
     nobody asked for, and a permission control should hand back exactly
     what it was asked about and nothing else. Surprises in this file are
     how it stops being reviewable.

     ⭐ The rule itself still lives in the view: feed_posts.photo_urls is
     already NULL on an anonymous post and the row is already gone if
     either person blocked the other. Photos inherit every rule for free,
     because we ask instead of deciding. */
  if (postPaths.length) {
    const askedSet = new Set(postPaths);
    const { data } = await supabase
      .from('feed_posts').select('photo_urls').overlaps('photo_urls', postPaths);
    (data || []).forEach((r) =>
      (r.photo_urls || []).forEach((p) => { if (askedSet.has(p)) allowed.add(p); }));

    /* ⚠️ photo_url (singular) is still read for now. The 0065 trigger keeps
       it equal to photo_urls[1], so this finds nothing the block above
       missed — it exists so that a page still rendering the old single
       column keeps working through the deploy. Delete it in the same
       change that drops the column. */
    const { data: legacy } = await supabase
      .from('feed_posts').select('photo_url').in('photo_url', postPaths);
    (legacy || []).forEach((r) => r.photo_url && allowed.add(r.photo_url));
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

  /* ⭐ A MEMBER'S RECORD (0058), AND THIS IS WHERE THE EXCLUSIVE HOLDS.

     Same question, same shape — but feed_drops returns `media_path` as
     NULL until the release time has passed. So asking the view "may this
     path be signed?" refuses an unreleased track WITHOUT this file
     knowing anything about release dates, countdowns or windows.

     ⚠️ That is the whole reason this is worth pointing at: had the rule
     been written here as `if (release_at > now) skip`, it would be a
     second copy of the rule in the view, and the second copy drifts. The
     view is asked. It answers. Nothing here decides.

     Cover art is checked separately and is NOT time-gated — a poster for
     something that hasn't landed yet is the entire point of a countdown. */
  if (dropPaths.length) {
    const { data: media } = await supabase
      .from('feed_drops').select('media_path').in('media_path', dropPaths);
    (media || []).forEach((r) => r.media_path && allowed.add(r.media_path));

    const { data: art } = await supabase
      .from('feed_drops').select('art_path').in('art_path', dropPaths);
    (art || []).forEach((r) => r.art_path && allowed.add(r.art_path));
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
                                  ['post-videos', 'videos/'],
                                  ['drops',       'drops/']]) {
    const paths = [...allowed].filter((p) => p.startsWith(prefix));
    if (!paths.length) continue;

    /* Serve what we already minted; only sign what we haven't. On a warm
       instance a repeat wall load signs NOTHING and every picture comes
       out of the browser's cache. */
    const missing = [];
    for (const p of paths) {
      const hit = cachedUrl(p);
      if (hit) urls[p] = hit; else missing.push(p);
    }
    if (!missing.length) continue;

    const { data } = await admin.storage.from(bucket).createSignedUrls(missing, TTL);
    (data || []).forEach((r) => {
      if (!r.signedUrl) return;
      urls[r.path] = r.signedUrl;
      remember(r.path, r.signedUrl);
    });
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
    /* ⚠️ EVERY photo, not just the first (0065). Miss this and a post's
       second through tenth pictures are never signed — which renders as
       broken images rather than as an error, so nobody reports it. */
    if (Array.isArray(r.photo_urls)) out.push(...r.photo_urls.filter(Boolean));
    if (r.photo_url)            out.push(r.photo_url);
    if (r.video_url)            out.push(r.video_url);
    if (r.display_avatar_photo) out.push(r.display_avatar_photo);
  }
  return out;
}
