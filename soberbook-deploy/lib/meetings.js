/* =====================================================================
   MEETINGS — reading the fellowships' own open data.

   Aug 17. Ty: "there's gotta be a way [into In The Rooms]. Think harder."

   There was, and it wasn't In The Rooms. AA and NA publish their meeting
   lists as public, documented JSON feeds — built by the fellowships so
   that third-party apps can read them. In The Rooms is a CONSUMER of this
   data, not the source of it. No partnership, no API key, no scraping.

   ⚠️ WHY NEW YORK AND NOT bmlt.virtual-na.org

   virtual-na.org was the obvious pick — worldwide coverage, timezones on
   every record. Then GetFormats on it returned `[]`. That server defines
   NO formats at all, so every meeting comes back access 'unknown', and
   open-vs-closed was the entire safety argument for listing meetings to
   anyone who isn't an addict themselves.

   New York is the mirror image: formats populated, time_zone empty.

   Coverage without the open/closed flag is worse than less coverage, so
   New York wins. Its meetings are VIRTUAL — "New York" is only where the
   group is rooted; anyone joins from anywhere. And the missing timezone
   is solvable honestly (see SOURCE.tz below) in a way the missing
   format flag is not.

   Full research note: "[C] Meetings - The Open Data Route.md"
   ===================================================================== */

const ROOT = 'https://bmlt.newyorkna.org/main_server';
const ENDPOINT = `${ROOT}/client_interface/json/?switcher=GetSearchResults`;

export const SOURCE = {
  name: 'Greater New York Region of NA',
  url: 'https://newyorkna.org/',
  fellowship: 'Narcotics Anonymous',
  /* ⚠️ A DECLARED zone for the whole server, not a per-record guess.

     Every record here comes back with time_zone: "". The tempting fix is
     to infer a zone per meeting from its latitude/longitude — which IS
     deterministic, but needs a lookup library and hides the assumption
     inside a function nobody re-reads.

     This is one geographic region's server. Stating its zone once, here,
     where a human reviewing this file can see it and disagree with it, is
     more honest than deriving it invisibly 300 times.

     ⚠️ If a second source is ever added, it needs its own declared zone
     and its own bounding check. Do NOT reuse this one. */
  tz: 'America/New_York',
  /* Rough box for the NY metro region. A record whose coordinates fall
     outside it is a data error on their end, and we show it WITHOUT a
     converted time rather than confidently print the wrong hour. */
  box: { latMin: 39.5, latMax: 45.5, lonMin: -80.0, lonMax: -71.0 },
};

function zoneFor(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
  const b = SOURCE.box;
  if (la < b.latMin || la > b.latMax || lo < b.lonMin || lo > b.lonMax) return '';
  return SOURCE.tz;
}

/* BMLT weekday_tinyint is 1 = Sunday. Not 0, and not Monday. Getting this
   off by one puts every meeting on the wrong day, and it would look
   plausible — which is the worst kind of wrong. */
const DAYS = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Format keys, verified against GetFormats on a live server Aug 17.
   These are the only four this file cares about. */
const OPEN   = 'O';   // open to non-addicts too — anyone may attend
const CLOSED = 'C';   // for people who have the addiction themselves
const TEMP   = 'TC';  // "Temporarily Closed Facility"

function splitFormats(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

/* =====================================================================
   ⚠️ WHY THIS IS A SEPARATE FUNCTION AND NOT AN INLINE TERNARY

   Open vs closed is not cosmetic. A closed meeting is for people who have
   the addiction themselves. Sending somebody's mother to one — she reads
   "Tuesday 7pm", she shows up, she's asked to leave — is a specific,
   avoidable harm, and it's the exact objection I raised against listing
   meetings at all before I found this field existed.

   So the third state matters as much as the first two. A meeting with
   NEITHER flag is not "probably open". It's unknown, and it gets labelled
   unknown, because a wrong guess here costs a real person a real evening.
   ===================================================================== */
function accessOf(formats) {
  if (formats.includes(OPEN))   return 'open';
  if (formats.includes(CLOSED)) return 'closed';
  return 'unknown';
}

function hhmm(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (!(h >= 0 && h <= 23 && min >= 0 && min <= 59)) return null;
  return { h, m: min };
}

function normalize(row) {
  const formats = splitFormats(row.formats);

  /* ⚠️ DROP #1 — the facility is shut. TC means the building is
     temporarily closed. Showing it as somewhere to go is how a person
     drives across town at night and finds a locked door. */
  if (formats.includes(TEMP)) return null;

  const day = Number(row.weekday_tinyint);
  if (!(day >= 1 && day <= 7)) return null;

  const time = hhmm(row.start_time);
  if (!time) return null;

  const link  = String(row.virtual_meeting_link || '').trim();
  const phone = String(row.phone_meeting_number || '').trim();

  /* ⚠️ DROP #2 — no way in. A virtual meeting with neither a link nor a
     dial-in is a row that does nothing when tapped. Every listing here
     has to be actionable or it's furniture. */
  if (!link && !phone) return null;

  /* ⚠️ DROP #3 — links must be https and must be links. The feed is
     good-faith volunteer data, not a trusted input. `javascript:` in an
     href is the classic way a data feed becomes a script injection, and
     "it's from AA" is not a security model. */
  let safeLink = '';
  if (link) {
    try {
      const u = new URL(link);
      if (u.protocol === 'https:' || u.protocol === 'http:') safeLink = u.toString();
    } catch { safeLink = ''; }
  }
  if (!safeLink && !phone) return null;

  return {
    id:      String(row.id_bigint || ''),
    name:    String(row.meeting_name || '').trim() || 'Narcotics Anonymous meeting',
    day,
    dayName: DAYS[day],
    /* Kept as parts, not a Date. See the timezone note in the page —
       converting here would bake in the SERVER's timezone, and the server
       is in whatever region Vercel put it. */
    hour:    time.h,
    minute:  time.m,
    /* The record's own zone if it has one, else the source's declared
       zone — but ONLY if the coordinates actually sit inside that
       source's region.

       ⚠️ An empty string here is a real, expected outcome, and the page
       must handle it. A meeting with no zone CANNOT be converted to your
       local time, and printing "7:00 PM" to somebody in Ohio when it
       means 7pm somewhere else is how a person sits alone in an empty
       room. No zone means no converted time — never a fallback guess. */
    tz:      String(row.time_zone || '').trim() || zoneFor(row.latitude, row.longitude),
    minutes: Number(String(row.duration_time || '').slice(0, 2)) * 60
           + Number(String(row.duration_time || '').slice(3, 5)) || null,
    access:  accessOf(formats),
    formats,
    link:    safeLink,
    phone,
    /* The feed puts meeting IDs and passwords in free text. Passed through
       for the dial-in case, but never parsed — guessing at a password out
       of a comment string and getting it wrong locks somebody out. */
    note:    String(row.virtual_meeting_additional_info || row.comments || '').trim(),
    lang:    String(row.lang_enum || '').trim(),
  };
}

/* =====================================================================
   THE FETCH.

   ⚠️ `revalidate: 3600` is not a performance tweak, it's manners. This is
   a volunteer-run server for a nonprofit fellowship. Fetching per page
   view would mean Sober Book hammers them once for every member who opens
   a tab. Next caches the result, so one request an hour serves everybody.

   If Sober Book ever gets big, this becomes a nightly job into our own
   table. It does not become "more requests".
   ===================================================================== */
export async function fetchMeetings() {
  const url = `${ENDPOINT}&formats[]=55`; // 55 = VM, Virtual Meeting

  let res;
  try {
    res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return { ok: false, reason: 'unreachable', meetings: [], fetchedAt: null };
  }

  if (!res.ok) return { ok: false, reason: `http_${res.status}`, meetings: [], fetchedAt: null };

  let raw;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, reason: 'bad_json', meetings: [], fetchedAt: null };
  }

  if (!Array.isArray(raw)) return { ok: false, reason: 'bad_shape', meetings: [], fetchedAt: null };

  const meetings = raw.map(normalize).filter(Boolean);

  /* ⚠️ A parsed-but-empty list is treated as a FAILURE, not as "there are
     no meetings". If the feed changes shape under us, the honest outcome
     is "we couldn't load these" — not a confident empty page telling
     somebody at 2am that no meeting exists. Silence and absence look
     identical to the person reading, and only one of them is true. */
  if (meetings.length === 0) {
    return { ok: false, reason: 'empty', meetings: [], fetchedAt: null };
  }

  meetings.sort((a, b) =>
    a.day - b.day || a.hour - b.hour || a.minute - b.minute || a.name.localeCompare(b.name)
  );

  return { ok: true, reason: null, meetings, fetchedAt: new Date().toISOString() };
}
