import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';
import { thumbCandidates } from '../../../../lib/feeds';
import { storeThumb } from '../../../../lib/content-thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* =====================================================================
   RE-PULL THE PICTURES WE ALREADY HAVE.  15 Sept 2026.

   ---------------------------------------------------------------------
   🔴 WHY THIS EXISTS, AND IT IS THE HALF THAT ACTUALLY SHIPS THE FIX.

   Raising the thumbnail resolution in the pullers only changes items that
   have not been fetched yet — both routes skip anything already in
   content_items, which is correct and is what stops the wall filling with
   duplicates. So without this route the change would be invisible on the
   wall for days, and the last time something shipped and looked identical
   the report back was "the video boxes didnt change".

   ⭐ A fix nobody can see is indistinguishable from a fix that did not
   happen. The backfill is not a follow-up task; it is the deploy.

   ---------------------------------------------------------------------
   ⚠️ IT WRITES TO THE SAME PATH ON PURPOSE.

   `srcId/extId.webp` is content-addressed by the video id, so overwriting
   it cannot point a row at a picture of something else. The alternative —
   a new filename per resolution — would orphan every old file, and
   `content-thumbs` is NOT in the sweeper's bucket list, so nothing on
   earth would ever clean them up. An overwrite is the only option here
   that does not leak storage permanently.

   ⚠️ That is also why the cache header in lib/content-thumb.js is a DAY
   and not a year: an overwrite has to be able to reach people.

   ---------------------------------------------------------------------
   ⚠️ CURSOR, NOT OFFSET, AND A SMALL BATCH.

   Each item is a fetch of up to three URLs plus an encode plus an upload,
   so a few hundred in one request would run past maxDuration and die
   halfway with no record of where it got to. The caller walks it with
   `after`, and because the write is an idempotent upsert to a fixed path,
   running the same batch twice costs time and nothing else.

   🔴 An OFFSET would be wrong, not merely slower: rows are ordered by id
   and nothing guarantees the set is stable between calls, so an offset
   silently skips items. A cursor cannot.
   ===================================================================== */

const BATCH = 20;

export async function POST(request) {
  /* Ty only, and 404 rather than 403 — the same door as /admin, the
     sweeper and the pull route. A polite refusal confirms the route is
     real to anyone who guesses the URL. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return new NextResponse('Not found', { status: 404 });

  const after = new URL(request.url).searchParams.get('after') || '';

  const admin = adminClient();
  let q = admin.from('content_items')
    .select('id, source_id, external_id, embed_id, thumb_path')
    .order('id', { ascending: true })
    .limit(BATCH);
  if (after) q = q.gt('id', after);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = [];
  for (const it of rows || []) {
    /* ⚠️ thumb_url is deliberately not selected — it is not a column. The
       candidate list for an existing row is built from embed_id alone,
       which is exactly what the pullers store and what YouTube's URLs are
       keyed on. A row with no embed_id (a podcast episode) has nothing
       predictable to ask for, so it is skipped rather than guessed at. */
    const urls = thumbCandidates({ embed_id: it.embed_id });
    if (!urls.length) { out.push({ id: it.id, skipped: 'no embed_id' }); continue; }

    const path = await storeThumb(admin, sharp, it.source_id, it.external_id, urls);
    if (!path) { out.push({ id: it.id, failed: true }); continue; }

    /* The path is unchanged in practice, but write it back anyway: if a
       row's thumb_path was null because an earlier pull failed, this is
       the call that finally gives that card a picture. */
    if (path !== it.thumb_path) {
      await admin.from('content_items').update({ thumb_path: path }).eq('id', it.id);
    }
    out.push({ id: it.id, path });
  }

  const last = (rows || []).length ? rows[rows.length - 1].id : null;
  return NextResponse.json({
    done: out.length,
    ok: out.filter((o) => o.path).length,
    failed: out.filter((o) => o.failed).length,
    skipped: out.filter((o) => o.skipped).length,
    after: last,
    more: (rows || []).length === BATCH,
  });
}
