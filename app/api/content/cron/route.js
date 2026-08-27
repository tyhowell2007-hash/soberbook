import { NextResponse } from 'next/server';
import { adminClient } from '../../../../lib/supabase-admin';
import { parseFeed } from '../../../../lib/feeds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* =====================================================================
   PULLING THE FEEDS ON A SCHEDULE.

   Ty: "is their a way to auto refresh the podcast videos". Yes — Vercel
   runs scheduled jobs, and vercel.json points one at this route daily.

   ⭐ A stale feed is worse than no feed. Seven channels showing the same
   videos for a fortnight reads as an abandoned product, and the people
   most likely to notice are the ones who came back after a while away.

   ---------------------------------------------------------------------
   🔴 WHY THIS ISN'T JUST /api/content/pull WITH A CRON POINTED AT IT.

   Two reasons, and the second is the one that matters:

     1. Vercel's scheduler only makes GET requests, and GET on the pull
        route is deliberately the DRY RUN — it reports and writes nothing.
        A cron on it would have run every day, reported cheerfully, and
        changed nothing. ⚠️ That failure is invisible: green logs, no
        errors, an empty feed. Exactly the kind of thing that goes
        unnoticed for a month.
     2. The pull route requires an admin SESSION. A scheduler has no
        session and never will.

   ---------------------------------------------------------------------
   ⭐ HOW THIS IS SAFE WITHOUT A SECRET.

   The obvious protection is a CRON_SECRET env var — and it's one more
   thing for Ty to set up in a dashboard, one more thing to leak, and one
   more thing that silently disables the job if it's ever wrong.

   Instead the route is RATE-LIMITED BY ITS OWN DATA: if any source was
   pulled successfully in the last MIN_GAP_HOURS, it refuses and says so.
   So the worst anybody can do by hammering this URL is make it say "not
   yet" — and it can't be used to spam YouTube on our behalf, because the
   answer doesn't depend on who is asking.

   ⚠️ That is a deliberate trade: no secret to manage, at the cost of the
   endpoint being publicly *reachable*. It is only safe because the action
   is idempotent and self-limiting. 🔴 If this route ever gains a side
   effect that isn't — deleting, emailing, charging — it needs real auth
   that day, not later.
   ===================================================================== */

const MIN_GAP_HOURS = 6;
const MAX_PER_SOURCE = 12;
const THUMB_W = 480;

async function fetchText(url) {
  const r = await fetch(url, {
    cache: 'no-store',
    headers: { 'user-agent': 'SoberBook/1.0 (+https://soberbook.app)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/* Fetch a thumbnail, re-encode, store it in OUR bucket. Returns null on
   any failure — an item with no picture is a worse card; an item that
   never appears because its picture 404'd is a missing episode.

   🔴 The whole reason this exists rather than storing YouTube's URL: an
   <img> pointing at i.ytimg.com makes every member's browser call Google
   on every wall load, announcing they're on a recovery app before they've
   tapped anything. */
async function storeThumb(admin, sharp, srcId, extId, url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const webp = await sharp(buf).rotate()
      .resize(THUMB_W, null, { withoutEnlargement: true })
      .webp({ quality: 78 }).toBuffer();
    /* ⚠️ NEVER add .withMetadata() — it puts back everything the
       re-encode just removed. Same rule as the photo pipeline. */
    const path = `${srcId}/${extId}.webp`;
    const { error } = await admin.storage.from('content-thumbs')
      .upload(path, webp, { contentType: 'image/webp', upsert: true });
    return error ? null : path;
  } catch { return null; }
}

export async function GET() {
  const admin = adminClient();
  const { default: sharp } = await import('sharp');

  /* 🔴 kind='org' ROWS ARE NOT FEEDS AND MUST NOT BE FETCHED.

     The poster ads (OCAAR, Operation Lean On Me, BrightView) live in this
     same table so they can ride the same wall-mixing logic. Their
     `feed_url` is a website — the thing a member taps — not an Atom feed.
     Fetching one and handing it to parseFeed produced a `last_error` on
     every source, every morning, for a card that is working perfectly.

     ⚠️ AND THE OBVIOUS FIX IS A TRAP: do NOT set these rows active=false
     to spare the cron. `active` carries TWO meanings — the cron pulls
     active sources, and `feed_content` filters on it too. Switching it off
     would hide the ad from every member on the wall. The filter belongs
     here, on `kind`, where it means only what it says. */
  const { data: sources, error: sErr } = await admin
    .from('content_sources').select('*')
    .eq('active', true).neq('kind', 'org').order('added_at');
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  /* 🔴 THE RATE LIMIT. See the header — this is what stands in for a
     secret. `last_ok_at` only moves when a pull genuinely returned items,
     so a run of failures can't lock the job out. */
  const newest = (sources || [])
    .map((s) => s.last_ok_at).filter(Boolean)
    .sort().slice(-1)[0];
  if (newest && Date.now() - new Date(newest).getTime() < MIN_GAP_HOURS * 3600 * 1000) {
    return NextResponse.json({
      skipped: true,
      reason: `pulled less than ${MIN_GAP_HOURS}h ago`,
      last_ok_at: newest,
    });
  }

  const report = { ran: new Date().toISOString(), added: 0, sources: [] };

  for (const s of sources || []) {
    const line = { label: s.label, parsed: 0, added: 0, error: null };
    try {
      const xml = await fetchText(s.feed_url);
      const items = parseFeed(s.kind, xml).slice(0, MAX_PER_SOURCE);
      line.parsed = items.length;

      if (!items.length) {
        /* 🔴 Zero entries is a FAILURE, not a quiet day. Silence and
           absence look identical from outside and only one is true — the
           Aug 17 lesson from the meetings feed. last_ok_at is left alone
           so "worked last Tuesday, broken since" stays visible. */
        line.error = 'feed parsed but contained no entries';
        await admin.from('content_sources').update({ last_error: line.error }).eq('id', s.id);
        report.sources.push(line);
        continue;
      }

      const ids = items.map((i) => i.external_id);
      const { data: have } = await admin.from('content_items')
        .select('external_id').eq('source_id', s.id).in('external_id', ids);
      const known = new Set((have || []).map((h) => h.external_id));

      for (const it of items) {
        if (known.has(it.external_id)) continue;
        const thumb = await storeThumb(admin, sharp, s.id, it.external_id, it.thumb_url);
        const { error } = await admin.from('content_items').insert({
          source_id: s.id,
          external_id: it.external_id,
          title: it.title,
          url: it.url,
          embed_id: it.embed_id,
          thumb_path: thumb,
          published_at: it.published_at || new Date().toISOString(),
        });
        if (!error) line.added++;
      }

      await admin.from('content_sources')
        .update({ last_ok_at: new Date().toISOString(), last_error: null }).eq('id', s.id);
    } catch (e) {
      line.error = e.message || String(e);
      /* ⚠️ last_ok_at NOT touched on failure — otherwise a source that
         broke a fortnight ago looks like it worked today. */
      await admin.from('content_sources').update({ last_error: line.error }).eq('id', s.id);
    }
    report.added += line.added;
    report.sources.push(line);
  }

  return NextResponse.json(report);
}
