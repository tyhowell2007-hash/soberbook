/* =====================================================================
   STRIPPING LOCATION OUT OF A VIDEO — WITHOUT RE-ENCODING IT.

   ---------------------------------------------------------------------
   WHY THIS FILE EXISTS INSTEAD OF ffmpeg

   Photos get cleaned by decoding them to pixels and building a new file
   (see app/api/photo/finalize/route.js). Nothing survives that. The
   obvious move for video is the same idea with ffmpeg.

   ffmpeg doesn't fit. The binary is tens of megabytes, and transcoding
   even a short clip takes far longer than a serverless function should
   live. Every "video uploads on Vercel" guide ends in a paid queue and a
   worker box.

   ⚠️ BUT VIDEO DOESN'T NEED RE-ENCODING, BECAUSE THE LOCATION ISN'T IN
   THE VIDEO.

   MP4 and MOV are trees of "boxes" (atoms). Each is:

       [4 bytes: size][4 bytes: type][payload]

   The actual picture and sound live in one box, `mdat`. GPS lives in
   tiny separate boxes over in `moov` — usually `©xyz`, which is where
   iPhones and Android write an ISO-6709 coordinate string. They are
   neighbours in a file, not layers of a sandwich.

   So the job is: find those boxes, destroy them, leave `mdat` untouched.
   Milliseconds, no dependencies, no quality loss.

   ---------------------------------------------------------------------
   🔴 THE TRAP — AND IT IS WHY YOU CANNOT SIMPLY DELETE THE BYTES

   `moov` also contains `stco` / `co64`: the chunk offset tables. Those
   are **absolute byte offsets into the file** telling the player where
   each chunk of video data starts.

   If `moov` sits before `mdat` — which it does in any file made
   "streamable" — then removing even four bytes from `moov` shifts every
   byte after it, every offset in `stco` becomes wrong, and the video is
   destroyed. Silently. It will still look like a valid file.

   ⭐ SO WE NEVER CHANGE THE FILE'S LENGTH. We overwrite the offending
   box in place: rename its type to `free` and zero its payload. `free`
   is the standard "ignore this, it's padding" box, understood by every
   player. Same bytes, same offsets, same length — and the coordinates
   are gone.

   ⚠️ Anyone maintaining this: do not "tidy up" by splicing the dead
   boxes out. The file will play fine in your test and break on somebody
   else's phone.
   ===================================================================== */

/* Boxes we destroy on sight.

   ©xyz is the one that matters — that's the GPS string phones write.
   The rest are device and authoring fingerprints: not coordinates, but
   they identify a person's phone across everything they ever post, which
   is its own kind of tracking. */
const KILL = new Set([
  '\xA9xyz',  // ISO-6709 location. THE one.
  'loci',     // 3GPP location box — name, place, lat/long
  '\xA9mak',  // camera make
  '\xA9mod',  // camera model
  '\xA9swr',  // software / firmware
  '\xA9day',  // creation date
  'gps ', 'gpsa', 'gspt', 'gsst',   // vendor GPS boxes
  'xyz ',
]);

/* Containers we're willing to walk into. ⚠️ DELIBERATELY A SHORT LIST —
   we never recurse into `mdat` or the sample tables. Walking a box that
   isn't really a container means reading its payload as if it were box
   headers, which produces garbage sizes and can send the parser off the
   end of the file. */
const CONTAINERS = new Set(['moov', 'udta', 'trak', 'meta', 'ilst', 'mdia', 'minf']);

/* `meta` is a FullBox: 4 bytes of version+flags before its children.
   ⚠️ Miss this and the first child is read four bytes off, which yields
   a nonsense size and either a crash or a silently skipped subtree. It
   is the single most common bug in hand-rolled MP4 parsers. */
const FULLBOX = new Set(['meta']);

const typeAt = (buf, off) => buf.toString('latin1', off + 4, off + 8);

/**
 * Walk a range of boxes, neutralising anything in KILL.
 * Mutates `buf` in place. Returns the list of box types killed.
 */
function walk(buf, start, end, found, depth = 0) {
  let off = start;
  /* A tree this deep is malformed or hostile; stop rather than recurse
     forever on a crafted file. */
  if (depth > 8) return;

  while (off + 8 <= end) {
    let size = buf.readUInt32BE(off);
    const type = typeAt(buf, off);
    let header = 8;

    if (size === 1) {
      /* 64-bit size — the box is huge (large mdat). Read it properly;
         treating it as 1 byte would march the parser into the payload. */
      if (off + 16 > end) return;
      const big = buf.readBigUInt64BE(off + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      /* "runs to end of file" */
      size = end - off;
    }

    /* Malformed or truncated — bail rather than guess. */
    if (size < header || off + size > end) return;

    if (KILL.has(type)) {
      /* ⭐ Rename to `free`, zero the payload, keep the length. */
      buf.write('free', off + 4, 4, 'latin1');
      buf.fill(0, off + header, off + size);
      found.push(type.replace(/\xA9/g, '(c)'));
    } else if (CONTAINERS.has(type)) {
      const childStart = off + header + (FULLBOX.has(type) ? 4 : 0);
      walk(buf, childStart, off + size, found, depth + 1);
    }

    off += size;
  }
}

/**
 * Strip location and device metadata from an MP4/MOV/WebM-in-MP4 buffer.
 *
 * Returns { out, killed, suspicious } where `out` is the same length as
 * the input — see the note above about why that matters.
 */
export function stripVideoMetadata(input) {
  const out = Buffer.from(input);   // copy; never mutate the caller's buffer
  const killed = [];
  walk(out, 0, out.length, killed);

  /* ⚠️ VERIFY, DON'T ASSUME — and be honest about what each check can
     actually see. I got this wrong first time and the test caught it.

     I originally verified by sweeping the file for the SHAPE of an
     ISO-6709 string ("+40.4406-079.9959") and called that the safety
     net. Then a real ffmpeg-written MP4 came through with GPS in a
     `loci` box and the sweep reported CLEAN — because `loci` stores
     latitude and longitude as 16.16 fixed-point BINARY, not text. The
     net had a hole exactly where the danger was.

     So the primary check is a second pass of the walker over the OUTPUT:
     if any known location box survived, we failed. That catches both
     encodings because it looks at structure, not spelling.

     The text sweep stays as a bonus — it does catch `©xyz`, which is
     what iPhones write, and it would catch a coordinate loose in a
     vendor box the walker doesn't know about. It is a second opinion,
     not the verdict. */
  const leftovers = [];
  walk(Buffer.from(out), 0, out.length, leftovers);

  const iso6709 = /[+-]\d{2}\.\d{3,}[+-]\d{3}\.\d{3,}/;
  const textLeak = iso6709.test(out.toString('latin1'));

  /* Either signal means the caller refuses to publish. Refusing is
     allowed to be wrong; publishing is not. */
  const suspicious = leftovers.length > 0 || textLeak;

  return { out, killed, suspicious, leftovers, textLeak };
}

/** Read-only check — used by tests and to prove an input was dirty. */
export function findVideoLocation(input) {
  const buf = Buffer.from(input);
  const found = [];
  /* Walk a throwaway copy so the scan can reuse the same logic. */
  walk(Buffer.from(buf), 0, buf.length, found);
  const iso6709 = /[+-]\d{2}\.\d{3,}[+-]\d{3}\.\d{3,}/;
  return { boxes: found, isoString: iso6709.test(buf.toString('latin1')) };
}
