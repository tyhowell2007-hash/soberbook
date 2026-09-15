/* =====================================================================
   READING A FEED, WITHOUT A LIBRARY AND WITHOUT AN API KEY.

   Ty, Aug 23: something to look at, mixed in with the posts. First two
   sources are Dopey Podcast and GITT Up — both recovery shows, both on
   YouTube, both publishing free public Atom XML at
   /feeds/videos.xml?channel_id=... No key, no quota, no token to rotate,
   nothing that can start charging us.

   ---------------------------------------------------------------------
   ⚠️ WHY THIS IS HAND-WRITTEN INSTEAD OF `npm i fast-xml-parser`.

   Not because parsing XML by hand is clever — it usually isn't. Because
   this app holds sober dates, private messages and anonymous posts, and
   every dependency is somebody else's code running on the server that
   can read all of it. A general XML parser is a lot of surface for two
   formats we control the list of.

   The trade is real and worth stating: this handles the two shapes below
   and nothing else. Point it at arbitrary XML and it will return an empty
   list — which the caller MUST treat as a failure, not as "no episodes".

   ---------------------------------------------------------------------
   🔴 AN EMPTY PARSE IS A FAILURE, NOT SILENCE.

   Same lesson as the meetings feed on Aug 17. A source that returns
   nothing and a source that is broken look identical from the outside,
   and only one of them is true. Every function here returns an array;
   deciding what zero means is content_sources.last_ok_at's job.
   ===================================================================== */

/* XML entities, including the numeric ones. ⚠️ &amp; MUST be decoded LAST.
   Decode it first and "&amp;lt;" — a literal, escaped "&lt;" in somebody's
   episode title — turns into "<", which then looks like markup to anything
   downstream. Order is the whole correctness of this function. */
export function decode(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');          // ⚠️ last, always
}

const one = (block, re) => { const m = block.match(re); return m ? decode(m[1]).trim() : null; };

/* Everything between <tag> and </tag>, repeated. Deliberately not a
   general matcher — it does not handle nesting of the same tag, which
   neither of these formats does for <entry> or <item>. */
function blocks(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>|<${tag}>[\\s\\S]*?<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml))) out.push(m[0]);
  return out;
}

/* =====================================================================
   YOUTUBE ATOM — verified against the live Dopey feed before this was
   written, rather than from memory. One <entry> looks like:

     <entry>
       <yt:videoId>Iib581adKCQ</yt:videoId>
       <title>Danny Boy Was 12 Years Sober…</title>
       <link rel="alternate" href="https://www.youtube.com/shorts/…"/>
       <published>2026-08-23T16:00:18+00:00</published>
       <media:group>
         <media:title>…</media:title>
         <media:thumbnail url="https://i2.ytimg.com/vi/…/hqdefault.jpg" …/>

   ⚠️ TAKE <title>, NOT <media:title>. Both exist and they are usually the
   same string — until they aren't. The entry's own title comes first in
   the document, which is why the plain /<title>/ match below is correct;
   if that order ever changes this silently starts reading the other one.

   ⚠️ The URL is built from the video id rather than read from <link>,
   because <link> points at /shorts/ for a short and /watch for an episode.
   /watch?v=ID works for both and is what our player expects.
   ===================================================================== */
export function parseYouTubeAtom(xml = '') {
  return blocks(xml, 'entry').map((e) => {
    const id = one(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!id) return null;
    const published = one(e, /<published>([^<]+)<\/published>/);
    return {
      external_id: id,
      title: one(e, /<title>([\s\S]*?)<\/title>/) || 'Untitled',
      url: `https://www.youtube.com/watch?v=${id}`,
      embed_id: id,
      thumb_url: (e.match(/<media:thumbnail[^>]*\burl="([^"]+)"/) || [])[1] || null,
      published_at: published || null,
      /* ⚠️ Kept so the puller can choose. A feed mixes 60-second clips and
         two-hour episodes, and they are not the same thing to somebody
         scrolling a wall at 2am. */
      is_short: /\/shorts\//.test(e),
    };
  }).filter(Boolean);
}

/* =====================================================================
   RSS 2.0 — for a real podcast feed rather than a YouTube channel. Not
   used by the first two sources; written now because the `podcast` kind
   already exists in 0057 and a half-supported kind is a trap.

   ⚠️ <guid> is optional in RSS and frequently missing. Falling back to
   the enclosure URL and then the link means external_id is stable across
   pulls, which is what stops the wall filling with duplicates.
   ===================================================================== */
export function parseRss(xml = '') {
  return blocks(xml, 'item').map((it) => {
    const link = one(it, /<link>([\s\S]*?)<\/link>/);
    const enclosure = (it.match(/<enclosure[^>]*\burl="([^"]+)"/) || [])[1] || null;
    const id = one(it, /<guid[^>]*>([\s\S]*?)<\/guid>/) || enclosure || link;
    if (!id) return null;
    const date = one(it, /<pubDate>([\s\S]*?)<\/pubDate>/);
    return {
      external_id: id,
      title: one(it, /<title>([\s\S]*?)<\/title>/) || 'Untitled',
      url: link || enclosure,
      embed_id: null,                  // an episode opens out; there is no inline player
      thumb_url: (it.match(/<itunes:image[^>]*\bhref="([^"]+)"/) || [])[1] || null,
      published_at: date ? new Date(date).toISOString() : null,
      is_short: false,
    };
  }).filter(Boolean);
}

export function parseFeed(kind, xml) {
  if (kind === 'youtube') return parseYouTubeAtom(xml);
  if (kind === 'podcast') return parseRss(xml);
  return [];
}

/* The feed URL for a YouTube channel id. ⚠️ Only accepts a real UC… id —
   a handle like @DopeyPodcast does NOT work on this endpoint, and the
   failure is an empty document rather than an error, which would look
   exactly like a channel that has never posted. */
export function youtubeFeedUrl(channelId) {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId || '')) return null;
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/* =====================================================================
   WHICH PICTURE TO ASK FOR, BEST FIRST.  15 Sept 2026.

   Ty: "the videos that are on the app need a different box." Measured on
   the live wall before anything was written, and the box was not the
   problem: the frame is 492x277 — exactly 16:9 — with object-fit:cover,
   which is correct. The picture inside it was the one the feed hands us,
   YouTube's hqdefault, at 480x360.

   ⭐ AND 480x360 IS A LIE. hqdefault pads a widescreen video with black
   bars to make a 4:3 file: measured on a real live item, 45px top and
   45px bottom, leaving 480x270 of actual picture. So the card was drawing
   480x270 across 492 CSS px on a 2x screen that wants 984 — about a
   quarter of the pixels it was painting. That is the softness, and no CSS
   fixes it, because the detail was never in the file.

   ⚠️ It is not even consistent. One live source (Kratom Real Talk,
   VTfLQ0wcz24) has NO bars — a genuine 4:3 frame — so `cover` in a 16:9
   box crops a quarter of that video off the top and bottom, which on a
   talking head is a forehead and a chin.

   ✅ maxresdefault came back 1280x720 for all ten live video ids tested,
   INCLUDING the 4:3 one — YouTube crops to 16:9 itself. So asking for
   maxres quadruples the detail AND takes the crop to zero.

   🔴 THE FALLBACK IS NOT OPTIONAL, AND ITS FAILURE MODE IS NASTY.
   maxresdefault does not exist for every video. Proven with a control:
   jNQXAC9IVRw ("Me at the zoo", 2005) returns 404 on maxresdefault and a
   real 480x360 on hqdefault. ⚠️ But the 404 body is a 1,097-byte grey
   120x90 JPEG — a perfectly valid image — so an <img> tag renders it
   happily and never fires onerror. Anything that tests this with an image
   element instead of a status code sees a picture and believes it.

   ⚠️ The id is matched STRICTLY at 11 characters. This builds a URL out
   of a string that arrived from a remote feed; a loose match is how that
   becomes somebody else's URL.
   ===================================================================== */
const YT_VARIANTS = ['maxresdefault', 'sddefault', 'hqdefault'];

export function thumbCandidates(item = {}) {
  const out = [];
  if (/^[A-Za-z0-9_-]{11}$/.test(item.embed_id || '')) {
    for (const v of YT_VARIANTS) {
      out.push(`https://i.ytimg.com/vi/${item.embed_id}/${v}.jpg`);
    }
  }
  /* The feed's own <media:thumbnail> last. For a podcast it is the only
     entry; for YouTube it is hqdefault again and therefore harmless — but
     it is the thing that keeps this correct if a future kind has no
     predictable URL scheme at all. */
  if (item.thumb_url) out.push(item.thumb_url);
  return [...new Set(out)];
}
