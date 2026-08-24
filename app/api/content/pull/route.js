import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';
import { parseFeed } from '../../../../lib/feeds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* =====================================================================
   PULLING THE FEEDS.

   Ty, Aug 23: comedy, music and healthy entertainment mixed in with what
   members post. First four sources are Dopey Podcast, GITT Up, Jason
   Ellis 2.0 and Just a Dad from Akron — all public YouTube channels, all
   publishing free Atom XML with no key, no quota and nothing that can
   start charging us.

   GET  = dry run. Reads the feeds, reports what WOULD change, writes
          nothing. Same shape as the orphan sweeper.
   POST = actually store it.

   ---------------------------------------------------------------------
   🔴 THUMBNAILS ARE COPIED TO OUR OWN BUCKET. THIS IS THE WHOLE REASON
   THIS ROUTE DOES MORE THAN INSERT ROWS.

   The obvious build stores YouTube's thumbnail URL and renders an <img>
   pointing at i.ytimg.com. That would make every member's browser call
   Google on every wall load — telling Google that this person, at this
   IP, at this hour, is looking at a recovery app. That is the exact leak
   the click-to-load player closed earlier tonight, walked back in through
   the pictures.

   So the picture is fetched once, HERE, on our server, re-encoded and
   stored. Google sees one server pulling a feed. It never sees a member.

   ⚠️ Re-encoding through sharp is not decoration. It normalises the file
   to webp and drops every metadata block in the process — the same reason
   the photo pipeline does it. We did not take that picture and have no
   idea what is attached to it.

   ---------------------------------------------------------------------
   🔴 AN EMPTY PARSE IS A FAILURE, NOT "NO NEW EPISODES."

   Aug 17's lesson from the meetings feed, and it applies harder here
   because these feeds are known to be intermittently flaky. A source that
   returns zero entries has its `last_error` set and `last_ok_at` left
   alone, so the difference between "quiet" and "broken" survives in the
   database instead of being flattened into silence.
   ===================================================================== */

const MAX_PER_SOURCE = 12;   // newest N per feed per pull; the wall isn't a firehose
const THUMB_W = 480;

async function fetchText(url) {
  const r = await fetch(url, {
    cache: 'no-store',
    /* ⚠️ A named agent, because scraping anonymously is how you get
       silently rate-limited and then spend an evening debugging a parser
       that was never wrong. */
    headers: { 'user-agent': 'SoberBook/1.0 (+https://soberbook.app)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/* Fetch a thumbnail, re-encode, store it, return the path. Returns null on
   any failure — ⚠️ deliberately soft. An item with no picture is a worse
   card; an item that never appears because its picture 404'd is a missing
   episode. The text is the point. */
async function storeThumb(admin, srcId, extId, url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const webp = await sharp(buf).rotate().resize(THUMB_W, null, { withoutEnlargement: true })
      .webp({ quality: 78 }).toBuffer();
    /* ⚠️ NEVER add .withMetadata() here, for the same reason it is banned
       in the photo pipeline: it puts back everything the re-encode just
       removed. */
    const path = `${srcId}/${extId}.webp`;
    const { error } = await admin.storage.from('content-thumbs')
      .upload(path, webp, { contentType: 'image/webp', upsert: true });
    if (error) return null;
    return path;
  } catch { return null; }
}

async function handle(request, write) {
  /* Ty only. ⚠️ 404, not 403 — same as /admin and the sweeper. A 403
     confirms the route exists to anyone who guesses the URL. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return new NextResponse('Not found', { status: 404 });

  const admin = adminClient();
  const { data: sources, error: sErr } = await admin
    .from('content_sources').select('*').eq('active', true).order('added_at');
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const report = { mode: write ? 'pull' : 'dry run', sources: [], added: 0, updated: 0 };

  for (const s of sources || []) {
    const line = { label: s.label, kind: s.kind, parsed: 0, added: 0, updated: 0, error: null };
    try {
      const xml = await fetchText(s.feed_url);
      const items = parseFeed(s.kind, xml).slice(0, MAX_PER_SOURCE);
      line.parsed = items.length;

      if (!items.length) {
        /* 🔴 Zero is an error, not a quiet day. See the header. */
        line.error = 'feed parsed but contained no entries';
        if (write) await admin.from('content_sources')
          .update({ last_error: line.error }).eq('id', s.id);
        report.sources.push(line);
        continue;
      }

      /* Which of these do we already hold? One query, not one per item. */
      const ids = items.map((i) => i.external_id);
      const { data: have } = await admin.from('content_items')
        .select('external_id, thumb_path').eq('source_id', s.id).in('external_id', ids);
      const known = new Map((have || []).map((h) => [h.external_id, h]));

      for (const it of items) {
        const existing = known.get(it.external_id);
        if (existing) { line.updated++; continue; }   // already have it; leave it alone
        line.added++;
        if (!write) continue;

        const thumb = await storeThumb(admin, s.id, it.external_id, it.thumb_url);
        const { error } = await admin.from('content_items').insert({
          source_id: s.id,
          external_id: it.external_id,
          title: it.title,
          url: it.url,
          embed_id: it.embed_id,
          thumb_path: thumb,
          published_at: it.published_at || new Date().toISOString(),
        });
        if (error) { line.error = error.message; line.added--; }
      }

      if (write) await admin.from('content_sources')
        .update({ last_ok_at: new Date().toISOString(), last_error: null }).eq('id', s.id);
    } catch (e) {
      line.error = e.message || String(e);
      /* ⚠️ last_ok_at is NOT touched on failure. A source that worked last
         Tuesday and has been broken since must still read as "last worked
         Tuesday", or there is no way to notice it has stopped. */
      if (write) await admin.from('content_sources')
        .update({ last_error: line.error }).eq('id', s.id);
    }
    report.added += line.added;
    report.updated += line.updated;
    report.sources.push(line);
  }

  return NextResponse.json(report);
}

export async function GET(request)  { return handle(request, false); }
export async function POST(request) { return handle(request, true);  }
