import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* =====================================================================
   THE ORPHAN SWEEPER — files nothing points at any more.

   ---------------------------------------------------------------------
   WHERE ORPHANS COME FROM

   Three ways, and none of them is a bug we can simply fix:

     1 · You attach a photo, then change your mind and never post. The
         file was already stripped and promoted; the post row that would
         have referenced it never existed.
     2 · finalize promotes the clean copy, then the `remove` of the raw
         quarantine file fails. Deliberate ordering — see the note at
         the bottom of finalize — because the alternative is destroying
         somebody's photo.
     3 · A post is deleted and the storage remove fails after the row is
         already gone.

   None of them is dangerous. A private bucket with nothing pointing at
   the file means nobody can see it — the signing route refuses to sign
   a path no view will vouch for, so it's unviewable even by the person
   who uploaded it. They just pile up and cost money.

   ⚠️ SO THIS IS HOUSEKEEPING, NOT A SAFETY CONTROL. That distinction
   decides every trade-off below: when in doubt, keep the file. The cost
   of keeping one too long is a fraction of a cent. The cost of deleting
   one too early is somebody's photo.

   ---------------------------------------------------------------------
   🔴 THE RACE, AND WHY THE GRACE PERIOD IS THE WHOLE DESIGN

   The obvious sweeper — "list the bucket, delete anything not in the
   database" — deletes live photos. Here's the window:

       finalize writes posts/abc.webp     ← in the bucket, in NO row yet
       ... the person is still typing a caption ...
       the post row is inserted           ← now it's referenced

   Between those two lines the file is a perfect orphan by every test we
   can run, and it is not an orphan at all. A sweeper running in that
   gap deletes the picture out from under somebody mid-sentence, and the
   post lands pointing at nothing.

   ⭐ So: nothing is touched until it has been sitting there for hours.
   The gap above is seconds. GRACE_HOURS is the margin, and it is
   deliberately absurd next to the thing it's protecting against —
   because being 100× too cautious costs nothing here and being slightly
   too eager costs a memory.
   ===================================================================== */

const GRACE_HOURS = 24;

/* quarantine gets a longer rope still. A raw file sitting there is
   invisible AND unstripped — but it's also the only surviving copy if
   finalize crashed halfway. Two days is enough to notice and go looking.
   Nothing serves out of this bucket, so waiting costs only storage. */
const QUARANTINE_GRACE_HOURS = 48;

const BUCKETS = [
  { bucket: 'post-photos', prefix: 'posts',   grace: GRACE_HOURS },
  { bucket: 'avatars',     prefix: 'avatars', grace: GRACE_HOURS },
  { bucket: 'post-videos', prefix: 'videos',  grace: GRACE_HOURS },
];

/* Supabase's list() is paginated and folder-scoped. It also returns a
   placeholder row for the folder itself, which has no id — filtering on
   `id` drops it. Without that filter the sweeper tries to delete the
   folder and the whole batch errors. */
async function listAll(admin, bucket, prefix) {
  const out = [];
  const LIMIT = 1000;
  for (let offset = 0; ; offset += LIMIT) {
    const { data, error } = await admin.storage.from(bucket)
      .list(prefix, { limit: LIMIT, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    const rows = (data || []).filter((o) => o.id);
    out.push(...rows);
    if ((data || []).length < LIMIT) break;
  }
  return out;
}

/* quarantine is laid out as <user_id>/<uuid>, so its objects live one
   level down and have to be found by walking the per-user folders. */
async function listQuarantine(admin) {
  const out = [];
  const folders = await listAllTop(admin, 'quarantine');
  for (const f of folders) {
    const kids = await listAll(admin, 'quarantine', f.name);
    out.push(...kids.map((k) => ({ ...k, name: `${f.name}/${k.name}` })));
  }
  return out;
}

async function listAllTop(admin, bucket) {
  const { data, error } = await admin.storage.from(bucket)
    .list('', { limit: 1000 });
  if (error) throw new Error(`list ${bucket}: ${error.message}`);
  /* ⚠️ The OPPOSITE filter to listAll: here we want the rows WITHOUT an
     id, because those are the folders. A real object at the root of
     quarantine would be something we didn't put there. */
  return (data || []).filter((o) => !o.id);
}

function ageHours(o) {
  const t = o.created_at || o.updated_at;
  /* ⚠️ No timestamp means we do NOT know how old it is, and an unknown
     age must read as "brand new" rather than "ancient". Guessing the
     other way deletes it. */
  if (!t) return 0;
  return (Date.now() - new Date(t).getTime()) / 36e5;
}

export async function POST(req) { return sweep(req, true); }
export async function GET(req)  { return sweep(req, false); }

async function sweep(req, destructive) {
  /* Ty only. Same is_admin flag the moderation queue uses. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  /* 404, not 403. Same as /admin: a 403 confirms the route exists. */
  if (!me?.is_admin) return new NextResponse('Not found', { status: 404 });

  const admin = adminClient();

  /* ---- what is still in use ---------------------------------------
     ⚠️ ONE query, asked BEFORE anything is listed or deleted, and the
     order matters. Ask the database first and the bucket second, and a
     file created in between reads as an orphan. This way round, a file
     created in between simply isn't in the listing yet — it survives to
     the next run. Every ambiguity resolves toward keeping the file. */
  const { data: refRows, error: refErr } = await admin.rpc('referenced_media');
  if (refErr) {
    return NextResponse.json({ error: `referenced_media: ${refErr.message}` },
                             { status: 500 });
  }
  const referenced = new Set((refRows || []).map((r) => r.path).filter(Boolean));

  /* 🔴 A SANITY GATE. If referenced_media() came back empty but the
     buckets are full, something is wrong — a broken grant, a renamed
     column, a migration half-applied — and the honest reading is "I
     don't know what's in use", not "nothing is in use". The second
     reading deletes every file in the system.

     A test that cannot fail is not a test; a sweeper that cannot refuse
     is not safe. */
  const suspiciouslyEmpty = referenced.size === 0;

  const report = { referenced: referenced.size, buckets: {}, deleted: 0,
                   destructive, refused: null };

  for (const { bucket, prefix, grace } of BUCKETS) {
    const objects = await listAll(admin, bucket, prefix);
    const paths   = objects.map((o) => `${prefix}/${o.name}`);
    const present = new Set(paths);

    /* 🔴 THE SECOND GATE, AND IT IS THE ONE THAT MATTERS.
    ————————————————————————————————————————————————————————————————
       I wrote a throwaway diagnostic query for this exact comparison
       and got it wrong: `storage.objects.name` already carries the
       folder, so re-prefixing produced `avatars/avatars/…` and EVERY
       FILE IN THE APP came back flagged as an orphan. In a sweeper
       that's not a wrong number on a screen, it's every photo deleted.

       The first gate — "did referenced_media() come back empty?" —
       would not have caught it. The list was full. It was the
       COMPARISON that was broken, and a broken comparison produces a
       confident, plausible, completely wrong answer.

       So: we know which files ARE referenced. If files with this
       prefix are referenced and NOT ONE of them turns up in the
       listing, we are not comparing the same two things. Refuse.

       ⭐ The general lesson, which is the same one as the meetings
       feed and the 307 redirect: a check that cannot fail is not a
       check. This one fails loudly the moment the two sides stop
       speaking the same language. */
    const expected = [...referenced].filter((p) => p.startsWith(`${prefix}/`));
    const matched  = expected.filter((p) => present.has(p));
    const mismatch = expected.length > 0 && matched.length === 0;

    const orphans = objects.filter((o) =>
      !referenced.has(`${prefix}/${o.name}`) && ageHours(o) >= grace);

    report.buckets[bucket] = {
      total: objects.length,
      inUse: matched.length,
      orphans: orphans.length,
      /* Named, so a dry run is reviewable rather than a number to
         trust. */
      paths: orphans.map((o) => `${prefix}/${o.name}`),
    };

    const blocked = suspiciouslyEmpty || mismatch;
    if (mismatch) {
      report.buckets[bucket].refused =
        `${expected.length} file(s) are referenced with the "${prefix}/" `
        + 'prefix and none of them appear in the bucket listing. The two '
        + 'sides are not being compared correctly, so every file here '
        + 'would look like an orphan. Nothing deleted.';
    }

    if (destructive && orphans.length && !blocked) {
      const { error } = await admin.storage.from(bucket)
        .remove(orphans.map((o) => `${prefix}/${o.name}`));
      if (error) report.buckets[bucket].error = error.message;
      else report.deleted += orphans.length;
    }
  }

  /* ---- quarantine: nothing here is ever referenced ----------------
     Everything in quarantine is either mid-flight or abandoned, so the
     only test is age. The sanity gate above doesn't apply — there is no
     database list to be wrong about. */
  const qObjects = await listQuarantine(admin);
  const qOld = qObjects.filter((o) => ageHours(o) >= QUARANTINE_GRACE_HOURS);
  report.buckets.quarantine = {
    total: qObjects.length, orphans: qOld.length,
    paths: qOld.map((o) => o.name),
  };
  if (destructive && qOld.length) {
    const { error } = await admin.storage.from('quarantine')
      .remove(qOld.map((o) => o.name));
    if (error) report.buckets.quarantine.error = error.message;
    else report.deleted += qOld.length;
  }

  if (suspiciouslyEmpty) {
    report.refused =
      'referenced_media() returned nothing. Refusing to delete from the '
      + 'live buckets — an empty answer here is far more likely to be a '
      + 'broken query than an empty app. Quarantine was still swept, '
      + 'because nothing in it is ever referenced.';
  }

  return NextResponse.json(report);
}
