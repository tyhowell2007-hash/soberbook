import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';
import { stripVideoMetadata } from '../../../../lib/strip-video';
import { stripAudioMetadata, findAudioTags } from '../../../../lib/strip-audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* A 50MB video takes real seconds to pull down and walk. The default
   function timeout would cut it off mid-strip — and a timeout here means
   the raw file sits in quarantine forever. */
export const maxDuration = 300;

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

/* Video gets its own, larger ceiling — a 30-second phone clip is tens of
   megabytes where no photo ever is. ⚠️ We hold the file twice in memory
   (the download, plus the copy the stripper works on), so this number is
   half of what the function can actually stand. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const KINDS = {
  post:   { bucket: 'post-photos', prefix: 'posts',   max: 1600, quality: 80 },
  avatar: { bucket: 'avatars',     prefix: 'avatars', max: 512,  quality: 82 },
  /* Cover art for a record. Bigger than an avatar because a sleeve is
     looked AT rather than glanced at, smaller than a post photo because
     it renders in a square that is never full-bleed. */
  dropart:{ bucket: 'drops',       prefix: 'drops',   max: 1000, quality: 82 },
};

/* ⚠️ `drop` is deliberately NOT in KINDS above. That map is the
   image pipeline — resize, re-encode, done. A record is audio or video
   and takes its own road below, the way video already does. Putting it
   in the map would send somebody's master through sharp. */

/* An MP3 starts with an ID3 tag or straight into a frame (11 set bits).
   A WAV is RIFF/WAVE. An M4A is a box tree — same as MP4, so it goes to
   the video stripper rather than the audio one.

   ⚠️ WE DO NOT ASK THE BROWSER. Same rule as sniffVideo below: the
   Content-Type was a hint we refused to trust. These are the bytes. */
function sniffAudio(buf) {
  if (buf.length < 12) return null;
  if (buf.toString('latin1', 0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg', boxed: false };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: 'mp3', mime: 'audio/mpeg', boxed: false };
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE')
    return { ext: 'wav', mime: 'audio/wav', boxed: false };
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    /* M4A/M4B are audio in an MP4 box tree. ⭐ Handed to the VIDEO
       stripper on purpose — same container, same absolute-offset trap,
       and lib/strip-audio.js would happily slice bytes out and destroy it. */
    if (brand.startsWith('M4A') || brand.startsWith('M4B'))
      return { ext: 'm4a', mime: 'audio/mp4', boxed: true };
  }
  return null;
}

const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'];

/* ---------------------------------------------------------------------
   WHAT IS THIS FILE, REALLY?

   ⚠️ We do NOT ask the browser. It told us a Content-Type back in step 1
   and that was a hint we deliberately refused to trust. Here we read the
   bytes.

   An MP4 or MOV starts with a box whose type is `ftyp`, at offset 4 —
   the first four bytes are that box's size. So bytes 4..8 spelling
   "ftyp" is the signature. The four bytes after that are the "major
   brand": `qt  ` means QuickTime (what an iPhone records), anything else
   in this family is MP4.

   WebM is a completely different container (it starts 1A 45 DF A3) and
   stores location in EBML tags our stripper knows nothing about. So we
   refuse it rather than pass it through unstripped. Phones don't produce
   WebM, so nothing real is lost — and "we didn't handle it, so we let it
   through" is exactly the failure this whole design exists to prevent.
   --------------------------------------------------------------------- */
function sniffVideo(buf) {
  if (buf.length < 12) return null;
  if (buf.toString('latin1', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('latin1', 8, 12);
  return brand === 'qt  '
    ? { ext: 'mov', mime: 'video/quicktime' }
    : { ext: 'mp4', mime: 'video/mp4' };
}

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

  /* ⚠️ The OUTER gate first, before we pull a single byte into memory.
     We don't yet know whether this is a photo or a video, so we check
     against the larger of the two limits. The tighter photo limit is
     applied below, once the bytes have told us what they are. Checking
     in the other order would mean buffering a 400MB file to discover we
     didn't want it. */
  if (blob.size > MAX_VIDEO_BYTES) {
    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json(
      { error: 'That file is too big. 50MB is the limit for video.' },
      { status: 413 });
  }

  const input = Buffer.from(await blob.arrayBuffer());

  /* ---- a record takes its own road ------------------------------- */
  if (body?.kind === 'drop') {
    const audio = sniffAudio(input);
    const vid   = sniffVideo(input);

    if (!audio && !vid) {
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: "We couldn't read that as audio or video. MP3, WAV, M4A, MP4 or MOV." },
        { status: 415 });
    }

    let out, ext, mime, isVideo = false;

    if (vid) {
      /* A music video. Identical treatment to a post video — rename the
         location boxes to `free` without moving a byte. */
      let stripped;
      try { stripped = stripVideoMetadata(input); }
      catch {
        await admin.storage.from('quarantine').remove([raw]);
        return NextResponse.json({ error: "That video couldn't be read." }, { status: 400 });
      }
      /* 🔴 Same refusal as a post video. Refusing is allowed to be wrong;
         publishing is not. */
      if (stripped.suspicious) {
        await admin.storage.from('quarantine').remove([raw]);
        return NextResponse.json({
          error: "We couldn't confirm the location data was removed, so we "
               + "didn't publish it. Nothing was saved.",
        }, { status: 422 });
      }
      out = stripped.out; ext = vid.ext; mime = vid.mime; isVideo = true;

    } else if (audio.boxed) {
      /* M4A — a box tree, so the VIDEO stripper. See sniffAudio. */
      let stripped;
      try { stripped = stripVideoMetadata(input); }
      catch {
        await admin.storage.from('quarantine').remove([raw]);
        return NextResponse.json({ error: "That file couldn't be read." }, { status: 400 });
      }
      out = stripped.out; ext = audio.ext; mime = audio.mime;

    } else if (audio.ext === 'mp3') {
      const r = stripAudioMetadata(input);
      if (!r.ok) {
        await admin.storage.from('quarantine').remove([raw]);
        return NextResponse.json(
          { error: "That file didn't have any audio in it." }, { status: 400 });
      }
      /* 🔴 THE REFUSAL, structural rather than textual. Re-walk the OUTPUT
         and see whether any tag survived — the same shape as the second
         box-walker pass over stripped video, and for the same reason:
         checking the output's STRUCTURE beats checking that the thing you
         meant to remove is spelled differently now. */
      if (findAudioTags(r.out).length) {
        await admin.storage.from('quarantine').remove([raw]);
        return NextResponse.json({
          error: "We couldn't confirm that file was cleaned, so we didn't "
               + "publish it. Nothing was saved.",
        }, { status: 422 });
      }
      out = r.out; ext = 'mp3'; mime = 'audio/mpeg';

    } else {
      /* WAV. ⚠️ Passed through UNSTRIPPED and that is a known gap — a WAV
         can carry a LIST/INFO chunk with names in it. It is here rather
         than refused because a WAV off a recorder is usually the rawest,
         least-tagged thing a member owns. 🔴 Revisit: either write the
         RIFF chunk walker or stop accepting WAV. Do not leave this
         comment as the only protection. */
      out = input; ext = 'wav'; mime = 'audio/wav';
    }

    const dpath = `drops/${crypto.randomUUID()}.${ext}`;
    const { error: dErr } = await admin
      .storage.from('drops').upload(dpath, out, { contentType: mime, upsert: false });

    await admin.storage.from('quarantine').remove([raw]);
    if (dErr) {
      return NextResponse.json({ error: "That file couldn't be saved." }, { status: 500 });
    }
    return NextResponse.json({ path: dpath, isVideo, kind: isVideo ? 'video' : 'audio' });
  }

  /* ---- video takes a different road entirely --------------------- */
  const video = sniffVideo(input);

  if (video) {
    /* An avatar is a face, not a film. Nothing in the UI offers this;
       the check exists because the UI is not where rules live. */
    if (body?.kind !== 'post') {
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: 'A profile picture has to be a photo.' }, { status: 415 });
    }

    /* Rename the location boxes to `free` and zero them, without moving
       a single byte. See lib/strip-video.js for why the length must not
       change — `stco` holds absolute offsets and shifting them destroys
       the video silently. */
    let stripped;
    try {
      stripped = stripVideoMetadata(input);
    } catch {
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: "That video couldn't be read. Try another one." },
        { status: 400 });
    }

    /* 🔴 THE REFUSAL. If anything that looks like a location survived the
       strip, the video does not get published — full stop. We delete it
       and say so plainly.

       Refusing is allowed to be wrong. Publishing is not. A false alarm
       costs somebody one re-record; a miss puts their home address on
       the internet under a promise that it wouldn't be. */
    if (stripped.suspicious) {
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json({
        error: "We couldn't confirm the location data was removed from that "
             + "video, so we didn't post it. Nothing was saved.",
      }, { status: 422 });
    }

    const vpath = `videos/${crypto.randomUUID()}.${video.ext}`;
    const { error: vErr } = await admin
      .storage.from('post-videos')
      .upload(vpath, stripped.out, { contentType: video.mime, upsert: false });

    if (vErr) {
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: "That video couldn't be saved. Try again." }, { status: 500 });
    }

    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json({ path: vpath, isVideo: true, killed: stripped.killed });
  }

  /* Not a video. Apply the tighter photo ceiling now that we know. */
  if (input.length > MAX_PROCESS_BYTES) {
    await admin.storage.from('quarantine').remove([raw]);
    return NextResponse.json(
      { error: 'That photo is too big to process. 25MB is the limit.' },
      { status: 413 });
  }

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
      /* Not a photo, and the video sniffer already said it isn't an
         MP4 or MOV either. That includes WebM, which we refuse on
         purpose — different container, different metadata format, and
         our stripper doesn't understand it. Letting an unhandled format
         through is the one failure mode this design exists to prevent. */
      await admin.storage.from('quarantine').remove([raw]);
      return NextResponse.json(
        { error: 'That file type can’t be posted. Photos, and MP4 or MOV video.' },
        { status: 415 });
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
