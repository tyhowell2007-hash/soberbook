import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

/* =====================================================================
   TRAFFIC — how many arrive, and what they do, PER DAY.  15 Sept 2026.

   Ty: "make me a new traffic viewer... I want to see how many we get per
   day... I want it live as well. And how many total we have in the whole
   app."

   ---------------------------------------------------------------------
   🔴 WHY THIS IS A ROUTE IN THE APP AND NOT AN ARTIFACT, WHICH IS THE
   WHOLE REASON IT EXISTS.

   The old traffic board is a Cowork artifact that reaches the database
   through the Supabase MCP connector. On 15 Sept at 21:17:42 UTC that
   connector started refusing every call — 800ms refusals against 2–5s
   successes, i.e. rejected at the door, not a slow database. The board
   went blind for the rest of the evening while the app itself was
   completely healthy and serving 299 members.

   ⭐ THE LESSON THAT SHAPED THIS FILE: a dashboard that reads your
   database through a THIRD PARTY can be taken down by that third party
   while the thing it measures is perfectly fine. This route has no
   dependency outside the app: Vercel talks to Postgres, the same way
   every other page already does. If this is down, the app is down, and
   then you have a real problem rather than a reporting one.

   ---------------------------------------------------------------------
   🔴 IT SELECTS `created_at` AND NOTHING ELSE. THAT IS THE SECURITY
   MODEL, NOT AN OPTIMISATION.

   The house rule on every owner surface since 0039 is counts only, never
   names. Here that rule is enforced by the SHAPE OF THE QUERY rather
   than by remembering to leave a field out of the response: the only
   column that crosses the wire from Postgres is a timestamp. There is no
   author_id, no handle, no body, in any variable in this file. So a bug
   in the bucketing below can produce a wrong NUMBER — it cannot produce
   a name, because no name was ever fetched.

   ⚠️ This matters more than usual because the reads run as the SERVICE
   ROLE, which walks past every RLS policy and every anonymity view in
   the schema. The views are what normally stop author_id reaching a
   screen. Down here those guards are switched off, so the guard has to
   be that we never ask.

   🔴 DO NOT add a "show me who" mode to this file. owner_stats() has
   deliberately had no filter variant and no sample-row variant since
   August, for the reason written in admin/numbers/page.jsx: at small
   numbers, "1 person posted today" beside a name IS the identification.
   If that question ever needs answering it needs its own conversation,
   not a query parameter here.

   ---------------------------------------------------------------------
   ⚠️ DAYS ARE EASTERN, NOT UTC.

   `member_today()` decides a member's day boundary from their own
   timezone (0125). A chart can't do that — it has one x-axis for
   everybody — so it uses America/New_York, which is Ty's day and the day
   every other number he reads is already in. Bucketing in UTC would make
   everything after 8pm Eastern land on tomorrow's bar, and the most
   active hours in this app are the evening ones. That would not look
   like a bug; it would look like quiet evenings.
   ===================================================================== */

const DAYS = 30;
const ZONE = 'America/New_York';

/* Which day did this happen on, in Ty's timezone? Intl does the whole
   job including DST, which hand-rolled offset arithmetic does not — and
   getting that wrong by an hour is exactly the 20 Aug meetings bug,
   where every time was four hours off and it hid inside a feeling. */
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const dayKey = (iso) => dayKeyFmt.format(new Date(iso));

/* The last N day-keys ending today, so a day with nothing on it still
   gets a bar. ⚠️ A series built only from rows that exist SKIPS empty
   days, which silently compresses the x-axis and makes a dead week look
   like a busy one. The zero is the information. */
function window(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(new Date(now.getTime() - i * 86400000)));
  }
  return out;
}

function bucket(rows, keys) {
  const tally = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows || []) {
    const k = dayKey(r.created_at);
    if (k in tally) tally[k] += 1;
  }
  return keys.map((k) => ({ day: k, n: tally[k] }));
}

export async function GET() {
  /* The session check is the caller's OWN cookie, never the service
     role — the point is to find out who is asking. ⚠️ 404 and not 403,
     matching /admin and /admin/numbers: a polite refusal confirms the
     route is real and worth attacking. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return new NextResponse('Not found', { status: 404 });

  if (!adminConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const db = adminClient();
  const keys = window(DAYS);
  const since = new Date(Date.now() - DAYS * 86400000).toISOString();

  /* ⚠️ head:true returns the COUNT AND ZERO ROWS. That is what makes the
     all-time totals free and unleakable — Postgres never sends a row at
     all, so there is nothing in the response to get wrong. */
  const total = (t) => db.from(t).select('id', { count: 'exact', head: true });
  /* ⚠️ Bounded to the window on purpose. An unbounded select would hit
     the client's default 1,000-row ceiling and SILENTLY return a short
     list — a chart that is quietly wrong is worse than one that errors,
     because nothing tells you to look. 30 days cannot approach it at
     current volume, and if it ever does the fix is pagination, not a
     bigger limit. */
  const series = (t) => db.from(t).select('created_at')
    .gte('created_at', since).limit(50000);

  const [
    mTot, pTot, cTot, msgTot, rmTot,
    mSer, pSer, cSer, msgSer, rmSer,
  ] = await Promise.all([
    total('profiles'), total('posts'), total('comments'),
    total('messages'), total('room_messages'),
    series('profiles'), series('posts'), series('comments'),
    series('messages'), series('room_messages'),
  ]);

  const firstErr = [mTot, pTot, cTot, msgTot, rmTot,
                    mSer, pSer, cSer, msgSer, rmSer].find((r) => r.error);
  if (firstErr) {
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }

  const joined = bucket(mSer.data, keys);
  const sum = (a) => a.reduce((t, d) => t + d.n, 0);
  const last = (a, n) => a.slice(-n);

  return NextResponse.json({
    /* Read at, so a stale board can SAY it is stale rather than quietly
       showing yesterday. The old artifact's failure mode was going blank;
       this one's should be going honest. */
    readAt: new Date().toISOString(),
    zone: ZONE,
    days: keys,
    totals: {
      members: mTot.count ?? 0,
      posts: pTot.count ?? 0,
      replies: cTot.count ?? 0,
      messages: msgTot.count ?? 0,
      roomMessages: rmTot.count ?? 0,
    },
    series: {
      joined,
      posts: bucket(pSer.data, keys),
      replies: bucket(cSer.data, keys),
      messages: bucket(msgSer.data, keys),
      room: bucket(rmSer.data, keys),
    },
    joinedToday: joined[joined.length - 1]?.n ?? 0,
    joinedWeek: sum(last(joined, 7)),
    joinedAvg30: Math.round((sum(joined) / DAYS) * 10) / 10,
    best: joined.reduce((b, d) => (d.n > b.n ? d : b), { day: null, n: 0 }),
  });
}
