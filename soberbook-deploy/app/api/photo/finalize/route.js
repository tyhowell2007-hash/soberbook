import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   STEP 2 OF 2 — STRIP IT, PROMOTE IT, DESTROY THE ORIGINAL.

   The browser has put a raw file in `quarantine`. Nothing can read it
   there. This route is the only way anything ever leaves.

     download from quarantine  →  strip + re-encode  →  write to the
     real bucket  →  DELETE the raw

   ⚠️ THE LIVE BUCKETS THEREFORE ONLY EVER CONTAIN STRIPPED FILES, and
   that is now provable by inspection rather than by trusting a code
   path: anything in post-photos or avatars got there through here.

   ---------------------------------------------------------------------
   ⚠️ THE 4.5MB LIMIT DOES NOT APPLY HERE

   Vercel caps the *request body*. This route's request body is a small
   JSON object naming a path. The file arrives via an outbound fetch from
   our server to Supabase, which is not a request body and is not capped.
   That is the whole trick.
   ===================================================================== */

/* What we will pull into a function's memory and process. Not the same
   as the bucket's 500MB runaway guard — that stops one upload eating the
   shared tier; this stops one upload eating the function's RAM. A 25MB
   photo is far beyond any phone. */
const MAX_PROCESS_BYTES = 25 * 1024 * 1024;

const KINDS = {
  post:   { bucket: 'post-photos', prefix: 'posts',   max: 1600, quality: 80 },
  avatar: { bucket: 'avatars',     prefix: 'avatars', max: 512,  quality: 82 },
};

const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'];

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const kind = KINDS[String(body?.kind || '')];
  const raw  = String(body?.path || '');

  if (!kind) {
    return NextResponse.json({ error: 'Unknown upload kind.' }, { status: 400 });
  }

  /* ⚠️ THE OWNERSHIP CHECK, AND IT IS THE WHOLE SECURITY OF THIS ROUTE.
     The caller names a path. Without this, anyone could name somebody
     else's quarantined file and publish it under their own name — a
     stranger's photo on your post, from one guessed string.

     Comparing the prefix works because upload-url puts the user id there
     and nowhere else. `${id}/` with the slash matters: without it,
     one user id that happens to prefix another would pass. */
  if (!raw.startsWith(`${user.id}/`)) {
    /* Same reply whether it's somebody else's or nonexistent — two
       different messages would let a caller probe which paths are real. */
    return NextResponse.json({ error: 'Nothing to finish.' }, { status: 404 });
  }

  const admin = adminClient();

  /* ---- pull it out of quarantine ---------------------------------- */
  const { data: blob, error: dlErr } = await admin
    .storage.from('quarantine').download(raw);

  if (dlErr || !blob) {
    return NextResponse.json({ error: 'Nothing to finish.' }, { status: 404 });
  }

  if (blob.size > MAX_PROCESS_BYTES) {
    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json(
      { error: 'That file is too big to process. 25MB is the limit.' },
      { status: 413 });
  }

  const input = Buffer.from(await blob.arrayBuffer());

  /* ---- strip and re-encode ---------------------------------------- *
     Identical pipeline to the old route, and every argument is still
     load-bearing — see the notes in upload/route.js. In short:

       limitInputPixels  guards against a decompression bomb
       .rotate() FIRST   applies EXIF orientation, then discards it
       fit: 'inside'     never crops somebody's face out
       .webp()           one output format, no smuggled metadata quirks

     ⚠️ sharp drops all metadata by default. Adding .withMetadata() here
     puts the GPS coordinates back and undoes the entire feature. */
  let output, meta;
  try {
    const pipeline = sharp(input, { limitInputPixels: 50_000_000 });
    meta = await pipeline.metadata();

    if (!IMAGE_FORMATS.includes(meta.format)) {
      /* ⚠️ THIS IS WHERE VIDEO CURRENTLY STOPS, ON PURPOSE. The bucket
         accepts video so the upload half is ready, but nothing can be
         promoted until there is a step that actually strips it. sharp
         cannot; video metadata needs ffmpeg, which cannot finish inside
         a Vercel function's time limit.

         Failing here means an unstripped video can reach quarantine and
         then die there. It can never reach a bucket anything reads. */
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: 'Videos are coming — photos only for now.' }, { status: 415 });
    }

    output = await pipeline
      .rotate()
      .resize({ width: kind.max, height: kind.max,
                fit: 'inside', withoutEnlargement: true })
      .webp({ quality: kind.quality })
      .toBuffer();
  } catch {
    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json(
      { error: "That photo couldn't be read. Try another one." }, { status: 400 });
  }

  /* ---- promote the clean copy ------------------------------------- */
  const path = `${kind.prefix}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await admin
    .storage.from(kind.bucket)
    .upload(path, output, { contentType: 'image/webp', upsert: false });

  if (upErr) {
    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json(
      { error: "That photo couldn't be saved. Try again." }, { status: 500 });
  }

  /* ---- and destroy the original ----------------------------------- *
     ⚠️ AFTER the clean copy is safely written, never before. If this
     delete fails we're left with an unreadable orphan in a bucket
     nothing serves — annoying. If we deleted first and the upload
     failed, we'd have destroyed the person's photo. Same reasoning as
     the row-before-file order in delete/route.js: pick the failure a
     person can live with. */
  await admin.storage.from('quarantine').remove([raw]);

  return NextResponse.json({
    path,
    width:  Math.min(meta.width  || kind.max, kind.max),
    height: Math.min(meta.height || kind.max, kind.max),
  });
}
