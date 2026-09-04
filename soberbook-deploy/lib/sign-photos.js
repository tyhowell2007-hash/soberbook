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

   Aug 26. Supabase cached egress hit **7.963 GB of a 5 GB free tier —
   159%** — from 113 MB of stored files. The same pictures going out
   roughly seventy times over.

   createSignedUrls() mints a NEW token every call, so a photo came back
   as a different URL on every wall load. A browser cannot use its cache
   for a URL it has never seen. Nothing was ever served from cache.

   ⭐ The content cards had this right by accident all along: their
   thumbnails sit in a PUBLIC bucket, so the URL never changes and the
   browser caches it forever. This gives private photos the same benefit
   without making any bucket public — 0022 gave these buckets no client
   policies at all, on purpose.

   ⚠️ THE FIRST ATTEMPT WAS AN IN-MEMORY Map AND IT FAILED IN PRODUCTION.
   Three loads, three signings instead of nine, byte-identical URLs — the
   logic was right. Then live, the URLs still changed every render,
   because **Vercel throws that memory away between requests.** The test
   exercised the logic and said nothing about the environment. Same shape
   as the Aug 25 SQL probe that passed while the app kept failing:
   testing the wrong layer.

   So the cache is in Postgres (0078), where it survives instances,
   regions and deploys.

   ⚠️ THE TOKEN LIFETIME IS UNCHANGED. The obvious fix is a longer expiry
   and it is the wrong one: a signed URL is a capability, and anyone
   holding it can open a member's photo until it dies. This changes how
   OFTEN we mint them, never how long they last.
   ===================================================================== */

/* ⚠️ RAISED FROM 60 WHEN POSTS COULD CARRY TEN PHOTOS (0065).

   A wall renders up to 60 posts. At one photo each, 60 was plenty. At ten
   each it is a tenth of what a full page can ask for — and the failure is
   the bad kind: `.slice()` drops the overflow silently, so pictures would
   simply not appear, with no error anywhere to notice.

   ⚠️ It is still a cap, not a promise. It bounds one signing request so a
   crafted page can't ask us to mint ten thousand URLs.

   🔴 Aug 26: this declaration was DELETED by accident — a text replacement
   that swallowed the comment above it took the const with it. `next build`
   passed clean, because an undefined identifier is a RUNTIME error, and
   the live wall 500'd for every member for seven minutes. A green build
   proves it compiles. Nothing more. */
const MAX = 400;

/* Retired ten minutes early — a URL handed out at the last second would
   be dead by the time the picture loaded. */
const REUSE_MS = (TTL - 600) * 1000;

async function readCache(admin, paths) {
  const out = {};
  if (!paths.length) return out;
  const { data, error } = await admin
    .from('signed_url_cache')
    .select('path, url')
    .in('path', paths)
    .gt('good_until', new Date().toISOString());
  /* ⚠️ Fails OPEN, deliberately. If the cache is unreadable we sign
     everything and the page still works — a slow wall beats a wall with
     no pictures. The cache is an optimisation, never a dependency. */
  if (error) return out;
  (data || []).forEach((r) => { out[r.path] = r.url; });
  return out;
}

async function writeCache(admin, minted) {
  if (!minted.length) return;
  const until = new Date(Date.now() + REUSE_MS).toISOString();
  try {
    await admin.rpc('remember_signed_urls', {
      p: minted.map(({ path, url }) => ({ path, url, until })),
    });
  } catch { /* see above — never let bookkeeping break a render */ }
}

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
  const roomPaths   = asked.filter((p) => p.startsWith('rooms/'));
  const dmPaths     = asked.filter((p) => p.startsWith('dms/'));

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

  /* 🛋️ A PICTURE IN THE FRONT ROOM (0093).
     Same shape as a post's photos, asked of `room_wall` instead — and
     that view already drops a message whose author has blocked you or
     been blocked by you, has been suspended, has deleted their account,
     or whose room has been closed. So a blocked person's photo stops
     being signable the instant the block lands, without one line here
     knowing what a block is.

     ⚠️ And the intersection matters for the same reason as posts:
     `.overlaps()` returns the message's WHOLE array, so without
     askedSet we would sign pictures nobody asked about. */
  if (roomPaths.length) {
    const askedSet = new Set(roomPaths);
    const { data } = await supabase
      .from('room_wall').select('photo_urls').overlaps('photo_urls', roomPaths);
    (data || []).forEach((r) =>
      (r.photo_urls || []).forEach((p) => { if (askedSet.has(p)) allowed.add(p); }));
  }

  /* ✉️ A PICTURE IN A DIRECT MESSAGE (0126).

     Same shape again, asked of `chat_messages` — the view the DM screen
     already reads through. That view returns a row only when the caller
     is one of the two people on the thread, drops a thread the caller
     declined, and drops it entirely if either person has blocked the
     other. So a DM photo inherits all three rules without this file
     knowing what a thread or a block is.

     ⭐ THIS IS WHY THE BUCKET IS SEPARATE. The prefix picks the view. Put
     a DM photo in post-photos and its path would start `posts/`, so the
     signer would ask `feed_posts` — which has never heard of it — and the
     picture would silently never appear. Worse in the other direction: a
     shared bucket would mean deciding audience from the row rather than
     the path, and the row is the thing an attacker is trying to talk you
     out of.

     ⚠️ askedSet for the same reason as posts and rooms: `.overlaps()`
     hands back the message's WHOLE array, so without the intersection we
     would sign pictures nobody asked about. Nothing leaks — if the
     message is visible so are its photos — but a permission control
     should return exactly what it was asked and nothing more. */
  if (dmPaths.length) {
    const askedSet = new Set(dmPaths);
    const { data } = await supabase
      .from('chat_messages').select('photo_urls').overlaps('photo_urls', dmPaths);
    (data || []).forEach((r) =>
      (r.photo_urls || []).forEach((p) => { if (askedSet.has(p)) allowed.add(p); }));
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
                                  ['drops',       'drops/'],
                                  ['room-photos', 'rooms/'],
                                  ['dm-photos',   'dms/']]) {
    const paths = [...allowed].filter((p) => p.startsWith(prefix));
    if (!paths.length) continue;

    /* Serve what was already minted; sign only what's missing. A repeat
       wall load signs NOTHING and every picture comes out of the browser's
       cache, because the URL is the same one it saw last time. */
    const known = await readCache(admin, paths);
    const missing = [];
    for (const p of paths) {
      if (known[p]) urls[p] = known[p]; else missing.push(p);
    }
    if (!missing.length) continue;

    const { data } = await admin.storage.from(bucket).createSignedUrls(missing, TTL);
    const minted = [];
    (data || []).forEach((r) => {
      if (!r.signedUrl) return;
      urls[r.path] = r.signedUrl;
      minted.push({ path: r.path, url: r.signedUrl });
    });
    await writeCache(admin, minted);
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
