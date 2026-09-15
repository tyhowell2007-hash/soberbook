/* =====================================================================
   FETCH A THUMBNAIL, RE-ENCODE IT, PUT IT IN OUR BUCKET.  15 Sept 2026.

   ---------------------------------------------------------------------
   🔴 WHY THIS FILE EXISTS AT ALL, AND IT IS NOT TIDINESS.

   This function was written TWICE — once in /api/content/cron and once in
   /api/content/pull — and the two copies had already drifted in whitespace
   and in how they returned. That is the 0046 -> 0047 -> 0049 shape that has
   cost this schema three outages: a rule restated in two places is a second
   implementation, and the second one drifts.

   It mattered the moment the thumbnail rule got more complicated than
   "fetch the URL". A fallback chain maintained in two files is a fallback
   chain that will be correct in one of them.

   ⚠️ Each route still owns its OWN sharp import (cron loads it lazily, pull
   statically), so sharp is passed in rather than imported here. The module
   that decides WHEN to run is not the module that decides WHAT to do.

   ---------------------------------------------------------------------
   🔴 THE WHOLE REASON WE COPY THE FILE INSTEAD OF LINKING TO GOOGLE'S:
   an <img> pointing at i.ytimg.com makes every member's browser call
   Google on every wall load, announcing that somebody is on a recovery
   app before they have tapped anything.
   ===================================================================== */

/* 960, not 480, and not 1280.

   The card frame is 492 CSS px. At the devicePixelRatio 2 that a phone
   actually renders with, that is 984 real pixels — so 960 is within 2.5%
   of pixel-perfect and the old 480 was under half of it.

   ⚠️ 1280 was measured and rejected on cost, not on looks: 128KB a
   picture against 68KB at 960, and egress is the dimension this project
   is already over on (7.963GB against a 5GB tier on 5 Sept). 14 clip
   cards on a wall, ~300 members, is not a rounding error. 960 buys back
   nearly all the sharpness for half the bytes. */
const THUMB_W = 960;

/* 🔴 THE PLACEHOLDER GATE. A variant YouTube does not have answers 404
   with a 1,097-byte grey 120x90 JPEG in the body — a real, decodable
   image. hqdefault is 480 wide, sddefault 640, maxresdefault 1280, so
   nothing we ever legitimately ask for lands under 400. */
const MIN_SRC_W = 400;

export async function storeThumb(admin, sharp, srcId, extId, urls) {
  for (const url of urls || []) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      /* The status is the real gate and it comes before anything reads the
         bytes — see the placeholder note above. */
      if (!r.ok) continue;

      const buf = Buffer.from(await r.arrayBuffer());
      const img = sharp(buf);
      const meta = await img.metadata();

      /* ⚠️ SECOND GATE, AND IT IS NOT BELT-AND-BRACES. The 404 is Google's
         choice and could be a 200 tomorrow; the placeholder's SIZE is the
         thing that actually distinguishes it. Without this, the day that
         status changes we silently store a grey square for every item and
         report success — which is the failure this codebase keeps having:
         not an error, a confident wrong answer. */
      if (!meta.width || meta.width < MIN_SRC_W) continue;

      const webp = await img.rotate()
        .resize(THUMB_W, null, { withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      /* ⚠️ NEVER add .withMetadata() — it puts back everything the
         re-encode just removed. Same rule as the photo pipeline. */

      const path = `${srcId}/${extId}.webp`;
      const { error } = await admin.storage.from('content-thumbs')
        .upload(path, webp, {
          contentType: 'image/webp',
          upsert: true,
          /* A day. Not the Supabase default of an hour, and deliberately
             not a year. The path is the video id, so in practice the
             picture at it never changes — but `upsert: true` means it CAN,
             and a year-long cache would make that overwrite a lie for a
             year to everybody who already had it. A day kills the repeat
             egress that matters and still lets a re-pull reach people. */
          cacheControl: '86400',
        });
      /* 🔴 A failed UPLOAD gives up rather than trying the next candidate.
         Storage refusing us is not the source picture's fault, and a
         different picture will not fix it — retrying would just fail three
         times instead of once. */
      if (error) return null;
      return path;
    } catch { /* this candidate is out; try the next one */ }
  }
  /* ⚠️ Null is SOFT on purpose. An item with no picture is a worse card;
     an item that never appears because its picture 404'd is a missing
     episode, and the text is the point. */
  return null;
}
