/* =====================================================================
   LINKS IN WHAT PEOPLE WRITE.

   Ty, Aug 23: a member posted about his unreleased music and dropped the
   link in a comment. It rendered as plain text — you had to select it,
   copy it, and leave Sober Book to hear anything. "We need to be able to
   access that music right in sober book."

   ⭐ THE FIRST MEMBER-DRIVEN FEATURE THAT ISN'T A BUG FIX. Somebody used
   the app the way they wanted to use it and the app didn't bend.

   ---------------------------------------------------------------------
   🔴 EVERY LINK LEAVING HERE IS referrerPolicy="no-referrer".

   Without it, the destination is told the visitor came from
   soberbook.app. For an ordinary site that's a marketing statistic; for
   this one it is a disclosure — it says the person on the other end of
   that click is in recovery, to a stranger, forever, in their logs.

   ⚠️ Same reason the whole app has no presence dots and strips GPS. A
   link is just another way to leak, and it leaks to somebody we have no
   agreement with.

   ---------------------------------------------------------------------
   ⚠️ AN EMBED IS NEVER LOADED UNTIL SOMEBODY ASKS FOR IT.

   This file only ever returns the INFORMATION needed to build a player.
   Rendering the iframe is the caller's job, and the caller must wait for
   a tap. An iframe loads the instant the page does — so merely scrolling
   past a post would announce this browser to Google or Spotify before a
   note played.

   That rule already exists in SongPlayer.jsx and it is not re-argued
   here; it is the same rule, applied to a second place.
   ===================================================================== */

/* ⚠️ Deliberately conservative. It stops at whitespace and trims the
   punctuation people put after a URL in a sentence, so "check it out
   https://x.com/song." doesn't produce a link with a full stop welded
   to the end — which 404s and looks broken. */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
function tidy(u) {
  let s = u;
  while (/[.,;:!?)\]}»”’]$/.test(s)) {
    // keep a trailing ) if the URL genuinely opened one (wikipedia et al)
    if (s.endsWith(')') && (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length - 1) break;
    s = s.slice(0, -1);
  }
  return s;
}

export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

/* ⭐ REUSED, NOT REWRITTEN. This is the parser from SongPicker.jsx — the
   hostname check matters, because a naive /v=([\w-]{11})/ happily matches
   a look-alike domain and would embed somebody else's page in our frame.
   SongPicker now imports this instead of keeping its own copy. */
export function youtubeId(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/
        .test(u.hostname)) return null;
  const v = u.hostname.endsWith('youtu.be')
    ? u.pathname.slice(1)
    : (u.searchParams.get('v') || u.pathname.split('/').pop());
  return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
}

/* THE 22 CHARACTERS THAT ARE A SPOTIFY TRACK, AND NOTHING ELSE.

   ⚠️ Lives HERE rather than in SongPicker for the 0046 → 0049 reason
   that is written at the top of ytId's old home: two copies of a
   hostname check is how one of them quietly stops matching a domain the
   other one blocks. The wall and the profile ask the same question, so
   they ask it in the same place.

   WHY THE ID AND NOT THE LINK: the answer goes into an iframe's src. A
   URL somebody pasted is a string that decides where the browser goes;
   22 characters from a fixed alphabet can only ever be a track. Narrow
   it before you trust it.

   ⚠️ TRACKS ONLY. An album or a playlist is a fine thing to post on the
   wall and is NOT "your song" — a profile that plays a 40-minute record
   is a different feature nobody asked for.

   ⚠️ The `/intl-xx/` segment is real: Spotify's own share sheet emits
   open.spotify.com/intl-de/track/ID abroad, and a pattern anchored at
   the start of the path rejects exactly the people who are not in the
   US. */
export function spotifyTrackId(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  /* The desktop app's "Copy Spotify URI" gives this shape, not a URL. */
  const uri = s.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];

  let u;
  try { u = new URL(s); } catch { return null; }
  /* Same hostname discipline as youtubeId: a look-alike domain must not
     be able to hand us an id we then embed. */
  if (u.protocol !== 'https:') return null;
  if (!/(^|\.)spotify\.com$/.test(u.hostname)) return null;

  const m = u.pathname.match(/(?:^|\/)track\/([A-Za-z0-9]{22})(?:$|\/)/);
  return m ? m[1] : null;
}

/* Spotify: /track/ID, /album/ID, /playlist/ID, /episode/ID */
function spotifyEmbed(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (!/(^|\.)spotify\.com$/.test(x.hostname)) return null;
  const m = x.pathname.match(/\/(track|album|playlist|episode|artist)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

/* ⚠️ SoundCloud needs its oEmbed-style player with the ORIGINAL url
   passed through — there is no id in the path to extract. */
function soundcloudEmbed(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (!/(^|\.)soundcloud\.com$/.test(x.hostname)) return null;
  return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u)
       + '&color=%231b6b4a&auto_play=true&hide_related=true&show_comments=false'
       + '&show_user=true&show_reposts=false&show_teaser=false';
}

function appleEmbed(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (!/(^|\.)music\.apple\.com$/.test(x.hostname)) return null;
  return 'https://embed.music.apple.com' + x.pathname + x.search;
}

function bandcampish(u) {
  const h = host(u);
  return /bandcamp\.com$/.test(h) || /audiomack\.com$/.test(h);
}

/* =====================================================================
   WHAT KIND OF LINK IS THIS?

   Returns one of:
     { kind:'play',  service, embed, url }   → can play inside Sober Book
     { kind:'out',   service, url, hostname} → opens somewhere else
   ===================================================================== */
export function classify(url) {
  const h = host(url);

  const yt = youtubeId(url);
  if (yt) return {
    kind: 'play', service: 'YouTube', url,
    embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
    tall: true,
  };

  const sp = spotifyEmbed(url);
  if (sp) return { kind: 'play', service: 'Spotify', url, embed: sp, tall: false };

  const sc = soundcloudEmbed(url);
  if (sc) return { kind: 'play', service: 'SoundCloud', url, embed: sc, tall: false };

  const ap = appleEmbed(url);
  if (ap) return { kind: 'play', service: 'Apple Music', url, embed: ap, tall: false };

  /* ⚠️ Bandcamp and Audiomack DO have embeds, but both need an internal
     numeric id that isn't in the public URL — you have to ask their API
     for it. Until that exists these open out, honestly, rather than
     showing a play button that turns out to be a link. A play button
     that navigates away is worse than a link. */
  if (bandcampish(url)) return { kind: 'out', service: 'Bandcamp', url, hostname: h };

  /* 🔴 DROPBOX FOLDERS CANNOT BE EMBEDDED AT ALL, by anybody. There is no
     player for a folder — it isn't one file. A single Dropbox FILE can be
     raw-linked, a folder never can. This is the actual link Ty asked
     about, so it is worth stating plainly rather than discovering later. */
  if (/dropbox\.com$/.test(h)) return { kind: 'out', service: 'Dropbox', url, hostname: h };

  return { kind: 'out', service: null, url, hostname: h };
}

/* Split a body into text and link pieces, in order, for rendering.

   🔴 `body = ''` IS NOT ENOUGH, AND THAT COST A LIVE PAGE ON 22 SEPT.
   A default parameter fills in for `undefined` only — `pieces(null)` keeps
   the null and dies on `null.matchAll`. A reply with a photo and no words
   stores `body = NULL` deliberately (send-comment.js: the CHECK asks
   whether there are words), so the FIRST caption-less photo reply crashed
   the whole thread for everyone who opened that post. Coerce here, where
   every caller is covered, rather than at each call site. */
export function pieces(body) {
  const src = typeof body === 'string' ? body : (body == null ? '' : String(body));
  const out = []; let last = 0;
  for (const m of src.matchAll(URL_RE)) {
    const raw = tidy(m[0]);
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    out.push({ t: 'link', v: raw });
    last = m.index + raw.length;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

/* The first thing in a body that can actually play. One card per post —
   ⚠️ five links should not become five autoplaying players. */
export function firstPlayable(body) {
  for (const p of pieces(body)) {
    if (p.t !== 'link') continue;
    const c = classify(p.v);
    if (c.kind === 'play') return c;
  }
  return null;
}
