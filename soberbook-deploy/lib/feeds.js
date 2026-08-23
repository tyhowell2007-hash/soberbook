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
