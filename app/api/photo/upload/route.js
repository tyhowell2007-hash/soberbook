import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

/* sharp is a native module — it cannot run on the edge runtime. Saying so
   explicitly means a wrong deploy fails at build time with a clear
   message, instead of at 2am with "module not found" in a log nobody is
   reading. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   THE UPLOAD ROUTE — where a photo stops being dangerous.

   ---------------------------------------------------------------------
   THE PROBLEM THIS EXISTS TO SOLVE

   A photo taken on a phone is not just a picture. Sitting inside the
   file, invisible, is an EXIF block that by default contains the GPS
   coordinates where the shutter was pressed — to about five metres.
   Also the device, the serial number on some cameras, and the exact
   timestamp.

   So: somebody in recovery posts a photo of their dog. They have just
   published their home address to everyone who can be bothered to run
   one command on the file. They will never know they did it.

   That is the entire reason this route exists.

   ---------------------------------------------------------------------
   WHY THE STRIPPING HAPPENS HERE AND NOT IN THE BROWSER

   The browser could do it — drawing an image to a canvas and re-exporting
   genuinely does destroy metadata, and it would be faster and cheaper.

   But the browser is a place a person can decline to run our code. If the
   browser also held the key to the bucket, the strip would be OPTIONAL:
   open devtools, call the storage API directly, and the original file
   lands untouched. A safety step that can be skipped protects only the
   people who were never at risk.

   So 0022 gave the browser no storage permissions at all — not stricter
   ones, NONE — and this route holds the only key. There is no path into
   those buckets that goes around this file.

   ---------------------------------------------------------------------
   WHY RE-ENCODE RATHER THAN JUST DELETE THE EXIF BLOCK

   Deleting the metadata block is the obvious fix and it's not enough,
   for three reasons:

     1. GPS hides in more than one place. There's EXIF, there's XMP,
        there's a JFIF comment, and some phones write vendor blocks. Strip
        "the EXIF" and you can still ship coordinates.
     2. A file that claims to be a .jpg needn't be one. Re-encoding means
        the bytes we store are bytes WE generated from decoded pixels — a
        file that isn't really an image fails to decode and never reaches
        the bucket.
     3. Appended payloads. You can staple anything to the end of a valid
        JPEG and most parsers won't care. Re-encoding drops it, because we
        rebuild from pixels rather than editing the original.

   Decode to pixels, throw the original away, write a new file. Nothing
   survives that except the picture.
   ===================================================================== */

/* Generous — a modern phone photo is 3–8MB and HEIC conversions can be
   bigger. This is the guard against somebody posting a 400MB file to
   fill the disk, not a quality setting. The OUTPUT is far smaller. */
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

const KINDS = {
  post:   { bucket: 'post-photos', prefix: 'posts',   max: 1600, quality: 80 },
  avatar: { bucket: 'avatars',     prefix: 'avatars', max: 512,  quality: 82 },
};

export async function POST(req) {
  /* ---- 1 · is this a member at all? -------------------------------- */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  /* ---- 2 · what did they send? ------------------------------------- */
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'That upload was malformed.' }, { status: 400 });
  }

  const file = form.get('file');
  const kind = KINDS[String(form.get('kind') || '')];

  if (!kind) {
    return NextResponse.json({ error: 'Unknown photo kind.' }, { status: 400 });
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No file was attached.' }, { status: 400 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: 'That photo is too big. 15MB is the limit.' }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  /* ---- 3 · decode, orient, shrink, re-encode ------------------------ *
     Every argument below is load-bearing:

     limitInputPixels — a "decompression bomb" is a tiny file that decodes
       to an enormous bitmap. 12,000 × 12,000 is 576MB of RAM from a 40KB
       upload, which takes the server down for everybody. 50 megapixels is
       comfortably above any real camera and well below dangerous.

     .rotate() with no argument — reads the EXIF orientation tag, turns
       the pixels the right way up, and then discards the tag. ⚠️ THIS
       LINE MUST COME FIRST. Phones very often store a photo sideways with
       a note saying "display this rotated". Strip the metadata without
       honouring it and every portrait photo in the app lands on its side
       — the classic bug that follows naive EXIF removal.

     fit: 'inside' / withoutEnlargement — never crop (cropping a face out
       of somebody's picture without asking is rude) and never upscale a
       small image into a blurry big one.

     .webp() — one output format for everything. Uniform means the render
       path has one case to handle, and no member can smuggle in a format
       with its own metadata quirks.

     ⚠️ sharp drops all metadata by default. Adding .withMetadata() here
     would put the GPS coordinates back and undo this entire file. It is
     one word and it would be silent. Don't. */
  let output, meta;
  try {
    const pipeline = sharp(input, { limitInputPixels: 50_000_000 });
    meta = await pipeline.metadata();

    if (!['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'].includes(meta.format)) {
      return NextResponse.json(
        { error: 'That file is not a photo.' }, { status: 415 });
    }

    output = await pipeline
      .rotate()
      .resize({ width: kind.max, height: kind.max,
                fit: 'inside', withoutEnlargement: true })
      .webp({ quality: kind.quality })
      .toBuffer();
  } catch {
    /* Deliberately vague to the member, because the detail is useless to
       them. ⚠️ And because of Aug 6: an error message is an output
       channel. sharp's own errors quote file internals, and echoing those
       back tells a prodding stranger about our processing stack. */
    return NextResponse.json(
      { error: "That photo couldn't be read. Try another one." }, { status: 400 });
  }

  /* ---- 4 · store it ------------------------------------------------- *
     The path carries its own prefix — 'posts/…' or 'avatars/…' — which
     is redundant with the bucket name and deliberately so. It means the
     stored string is self-describing: the signing route works out which
     bucket to look in FROM THE VALUE ITSELF rather than from a parameter
     the caller supplies. A caller can't point an avatar path at the post
     bucket, because there's nothing to point with.

     crypto.randomUUID(), not the member's id and not a counter. A
     predictable path is a browsable one, and a path containing a user id
     would link two photos to the same person even after the posts were
     deleted. */
  const path = `${kind.prefix}/${crypto.randomUUID()}.webp`;

  const { error } = await adminClient()
    .storage.from(kind.bucket)
    .upload(path, output, { contentType: 'image/webp', upsert: false });

  if (error) {
    return NextResponse.json(
      { error: "That photo couldn't be saved. Try again." }, { status: 500 });
  }

  /* The path only. Never a URL — see the shape constraint in 0022. */
  return NextResponse.json({
    path,
    width:  Math.min(meta.width  || kind.max, kind.max),
    height: Math.min(meta.height || kind.max, kind.max),
  });
}
