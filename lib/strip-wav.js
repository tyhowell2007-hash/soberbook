/* =====================================================================
   CLEANING A WAV.

   The last gap in the drop pipeline. MP3 tags and MP4 boxes were handled
   the night drops shipped; WAV was accepted and passed through UNSTRIPPED
   with a comment admitting it. A comment is not protection.

   ---------------------------------------------------------------------
   🔴 WHAT A WAV ACTUALLY CARRIES, AND WHY IT'S WORSE THAN AN MP3.

   An MP3 leaks names. A WAV off a field recorder or a DAW leaks names AND
   equipment AND, sometimes, coordinates:

     LIST/INFO  IART artist · ICMT comment · ISFT the software AND ITS
                REGISTERED USER · INAM · ICRD the date it was recorded
     bext       Broadcast Wave Extension — Description, Originator,
                OriginatorReference, CodingHistory. Zoom, Tascam and Sound
                Devices recorders write the DEVICE SERIAL NUMBER here, and
                some write GPS.
     iXML       an entire XML document of production metadata
     id3        yes — a full ID3 tag, inside a WAV
     _PMX       Adobe XMP, which carries whatever Premiere or Audition knew

   ⭐ Somebody records a voice memo about their worst night on a handheld
   recorder and the file quietly names the device, the software, the date
   and the person the software is registered to.

   ---------------------------------------------------------------------
   ⭐ AN ALLOWLIST, NOT A BLOCKLIST. THIS IS THE WHOLE DESIGN.

   The obvious build lists the dangerous chunks and removes them. That is
   wrong here in a specific way: the list of metadata chunks grows every
   time a manufacturer invents one, and a chunk we've never heard of is
   exactly the one most likely to contain something surprising.

   So: keep `fmt `, `data` and `fact`, and drop EVERYTHING ELSE. A WAV
   needs nothing but those to play. Anything unrecognised is discarded by
   default rather than carried by default — the same reasoning that makes
   the video stripper REFUSE a container it doesn't understand instead of
   passing it through.

   ---------------------------------------------------------------------
   ⚠️ THIRD CONTAINER, THIRD SET OF RULES.

     MP4/M4A — NEVER change the length. `moov` holds absolute byte offsets
               and removing bytes silently destroys the file.
     MP3     — cutting IS safe. Self-delimiting frames, no index.
     WAV     — cutting is safe TOO, but the RIFF header declares the total
               size and MUST be rewritten. Forget that and half the tools
               in the world call the file corrupt while it still plays.

   Confusing any two of these produces a file that plays for a few seconds
   and then doesn't.
   ===================================================================== */

/* Everything a WAV needs to be a WAV. `fact` is only required for
   compressed formats but is harmless and tiny, so it stays rather than
   being a special case somebody has to remember. */
const KEEP = new Set(['fmt ', 'data', 'fact']);

export function isWav(buf) {
  return buf.length >= 12
      && buf.toString('latin1', 0, 4) === 'RIFF'
      && buf.toString('latin1', 8, 12) === 'WAVE';
}

/* Walk the chunk list. Returns what's there without changing anything —
   used to PROVE an output is clean, the same way the box walker is used
   on stripped video. Checking the output's STRUCTURE beats checking that
   the thing you meant to remove is spelled differently now. */
export function listWavChunks(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!isWav(buf)) return [];
  const out = [];
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    /* ⚠️ A chunk claiming to be bigger than the file is either corrupt or
       hostile. Stop rather than read past the end. */
    if (size > buf.length - off - 8) { out.push({ id, size, truncated: true }); break; }
    out.push({ id, size });
    /* ⚠️ RIFF chunks are WORD-ALIGNED: an odd-sized chunk is followed by
       one padding byte that is NOT counted in its size. Miss this and
       every chunk after the first odd one is read from the wrong offset,
       which looks like a corrupt file rather than a parsing bug. */
    off += 8 + size + (size % 2);
  }
  return out;
}

export function stripWavMetadata(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!isWav(buf)) return { out: buf, removed: 0, ok: false, why: 'not a RIFF/WAVE file' };

  const kept = [];
  let off = 12;
  let sawData = false;
  let sawFmt = false;

  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (size > buf.length - off - 8) break;          // truncated tail, drop it
    const padded = 8 + size + (size % 2);

    if (KEEP.has(id)) {
      kept.push(buf.subarray(off, Math.min(off + padded, buf.length)));
      if (id === 'data') sawData = true;
      if (id === 'fmt ') sawFmt = true;
    }
    off += padded;
  }

  if (!sawFmt || !sawData) {
    /* 🔴 Refuse rather than return something. A WAV with no fmt or no data
       isn't audio, and handing back a "cleaned" file that won't play is
       worse than saying we couldn't read it. */
    return { out: buf, removed: 0, ok: false, why: 'no fmt or data chunk found' };
  }

  const body = Buffer.concat(kept);
  const out = Buffer.alloc(12 + body.length);
  out.write('RIFF', 0, 'latin1');
  /* 🔴 THE SIZE FIELD IS EVERYTHING AFTER THESE FIRST 8 BYTES. Rewriting
     it is not optional — a RIFF header that disagrees with the real
     length is the single most common way a hand-edited WAV ends up
     "corrupt" in one tool and fine in another. */
  out.writeUInt32LE(4 + body.length, 4);
  out.write('WAVE', 8, 'latin1');
  body.copy(out, 12);

  return { out, removed: buf.length - out.length, ok: true };
}
