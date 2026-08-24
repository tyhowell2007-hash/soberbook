/* =====================================================================
   CLEANING AN AUDIO FILE BEFORE IT GOES ANYWHERE.

   Built for drops (0058). A member uploads a track; the file they picked
   off their laptop is very often carrying more than the music.

   ---------------------------------------------------------------------
   🔴 WHAT IS ACTUALLY IN AN MP3 SOMEBODY EXPORTS FROM A DAW.

   Not GPS, usually — the danger here is different from photos and it is
   arguably worse, because it's names. An ID3 tag routinely carries:

     TPE1 artist · TALB album · COMM comments · TCOM composer
     TENC the encoding software AND ITS REGISTERED USER
     TIT1/TIT3 working titles · WOAR the artist's home page
     TXXX arbitrary key/value pairs a DAW can put anything in
     APIC embedded artwork — a whole second image with its OWN metadata

   A track bounced from Logic on somebody's own machine can carry their
   full legal name in TENC, a rough-mix comment naming the studio, and
   embedded art with the photographer's camera serial in it. Somebody
   posting anonymously about their recovery does not expect the song they
   attached to introduce them.

   ---------------------------------------------------------------------
   ⭐ AND HERE THE BYTES *CAN* BE CUT — WHICH IS THE OPPOSITE OF VIDEO.

   lib/strip-video.js has a rule in capitals: NEVER change an MP4's
   length, because `moov` holds absolute byte offsets into the file and
   removing four bytes silently destroys every one of them.

   MP3 is the reverse. It has no index — it's a stream of self-delimiting
   frames, each carrying its own header and its own length. Nothing in an
   MP3 refers to a position in the file. So the ID3v2 block at the front
   and the ID3v1 block at the back can simply be sliced off, and what's
   left is a valid MP3 that starts at the first frame.

   ⚠️ Two containers, two opposite rules, and confusing them destroys
   files in a way that still plays for the first few seconds. An .m4a is
   NOT handled here — it is a box tree exactly like an .mp4, so it goes
   through stripVideoMetadata() instead.
   ===================================================================== */

/* ID3v2's size field is a "syncsafe" integer: four bytes, but only the
   low SEVEN bits of each count, so no byte can ever be 0xFF and be
   mistaken for the start of an MP3 frame.

   ⚠️ Reading it as a normal big-endian 32-bit int is the classic bug. It
   gives a number that is too LARGE, so the strip cuts into real audio and
   the track starts a second or two late — which sounds like a bad export
   rather than like corruption, so nobody reports it. */
function syncsafe(buf, off) {
  return ((buf[off] & 0x7f) << 21) |
         ((buf[off + 1] & 0x7f) << 14) |
         ((buf[off + 2] & 0x7f) << 7) |
          (buf[off + 3] & 0x7f);
}

export function hasId3v2(buf) {
  return buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3';
}

export function id3v2Length(buf) {
  if (!hasId3v2(buf)) return 0;
  const flags = buf[5];
  /* Bit 4 = a footer is present, which adds another 10 bytes at the end
     of the tag. Rare, and forgetting it leaves ten bytes of garbage
     before the first frame — most decoders resync and hide it. */
  const footer = (flags & 0x10) ? 10 : 0;
  return 10 + syncsafe(buf, 6) + footer;
}

/* ID3v1: exactly 128 bytes at the very end, starting with "TAG". Holds
   title, artist, album, year and a comment. Ancient, tiny, and still
   written by plenty of tools. */
export function hasId3v1(buf) {
  return buf.length > 128 &&
         buf.toString('latin1', buf.length - 128, buf.length - 125) === 'TAG';
}

/* APEv2 sometimes sits between the audio and the ID3v1 tag. Its footer is
   the last 32 bytes of the APE block and declares the size of everything
   above it. ⚠️ Not searched for exhaustively — only checked immediately
   before wherever the audio currently ends, because scanning the whole
   file for the string "APETAGEX" would happily match it inside the audio
   itself and truncate the track. */
function apeLengthAtEnd(buf, end) {
  if (end < 32) return 0;
  if (buf.toString('latin1', end - 32, end - 24) !== 'APETAGEX') return 0;
  const size = buf.readUInt32LE(end - 20);      // includes the footer
  return size > 0 && size <= end ? size : 0;
}

/* =====================================================================
   Returns { out, removed } — the cleaned buffer and how many bytes went.

   ⚠️ Returns the INPUT UNCHANGED rather than throwing when it doesn't
   recognise the file. The caller decides whether an unrecognised file may
   be published; this function's job is to be honest about what it did.
   `removed: 0` on a file that had tags would be a lie, so the checks
   above are deliberately conservative — better to leave a tag we weren't
   sure about and let the caller refuse the upload.
   ===================================================================== */
export function stripAudioMetadata(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let start = 0;
  let end = buf.length;

  start += id3v2Length(buf);

  if (hasId3v1(buf)) end -= 128;
  const ape = apeLengthAtEnd(buf, end);
  if (ape) end -= ape;

  if (start >= end) {
    /* Nothing but tags. A file with no audio in it is not a track, and
       silently returning an empty buffer would put a zero-byte "song" on
       somebody's release. */
    return { out: buf, removed: 0, ok: false, why: 'no audio found outside the tags' };
  }

  /* ⚠️ MP3 frames start with eleven set bits. Checking for them proves we
     cut to a real frame boundary rather than into the middle of one — the
     difference between a clean track and one that opens with a click. */
  const sync = buf[start] === 0xff && (buf[start + 1] & 0xe0) === 0xe0;

  return {
    out: buf.subarray(start, end),
    removed: (buf.length - (end - start)),
    ok: true,
    framesAligned: sync,
  };
}

/* What's still in there, for verification rather than for stripping.
   ⚠️ Used to PROVE a file came out clean — the same shape as the second
   box-walker pass over stripped video, and for the same reason: checking
   the output structurally beats checking that the thing you meant to
   remove is spelled differently now. */
export function findAudioTags(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const found = [];
  if (hasId3v2(buf)) found.push({ tag: 'ID3v2', bytes: id3v2Length(buf) });
  if (hasId3v1(buf)) found.push({ tag: 'ID3v1', bytes: 128 });
  const ape = apeLengthAtEnd(buf, buf.length - (hasId3v1(buf) ? 128 : 0));
  if (ape) found.push({ tag: 'APEv2', bytes: ape });
  return found;
}
