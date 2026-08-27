import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   PUTTING A FLYER ON THE WALL (0071).

   Molly O'Neill agreed tonight that OCAAR would post on Sober Book's home
   feed. 🔴 No money changes hands — see the note in 0071 for why that
   distinction is load-bearing.

   ⭐ THIS EXISTS SO A FLYER IS A THIRTY-SECOND JOB, NOT A CONVERSATION.
   The first one could have been a hand-written SQL insert. The second one
   would have been too, and the fifth, and by then it is a chore that
   quietly stops happening. An organisation that posts twice and gives up
   because it is awkward is worse than one that never started.

   ---------------------------------------------------------------------
   🔴 THE PICTURE IS COPIED INTO OUR BUCKET. ALWAYS.

   Same rule as the YouTube thumbnails: rendering a flyer straight from
   ocaar.org — or worse, from a Facebook CDN — makes every member's
   browser call that host on every wall load, announcing to a third party
   that this person is on a recovery app before they have touched
   anything. A picture is a request too.

   ⚠️ And it is RE-ENCODED, not just copied. A flyer is usually a photo of
   a poster or an export from Canva, and both carry metadata. sharp's
   pipeline drops it. ⚠️ NEVER add .withMetadata() — that puts back
   exactly what this line removes.

   ---------------------------------------------------------------------
   ⚠️ ADMIN ONLY, AND 404 RATHER THAN 403.

   403 confirms the route exists. 404 tells an unauthorised caller
   nothing. Same shape as /api/content/hide.
   ===================================================================== */

const MAX_BYTES = 8 * 1024 * 1024;
const WIDTH = 900;

export async function POST(req) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }

  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  /* ⚠️ Read is_admin from the member's OWN profile row, which RLS scopes
     to auth.uid(). Never from anything the caller sent. */
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const form = await req.formData();
  const file    = form.get('flyer');
  const title   = String(form.get('title') || '').trim();
  const url     = String(form.get('url') || '').trim();
  const place   = String(form.get('place') || '').trim() || null;
  const eventAt = String(form.get('event_at') || '').trim() || null;
  const label   = String(form.get('source') || 'OCAAR').trim();

  if (!title) return NextResponse.json({ error: 'Give it a title.' }, { status: 400 });

  /* 🔴 REFUSE AN EVENT THAT HAS ALREADY HAPPENED.
     The very first flyer sent for this feature was seventeen days past. A
     stale event is not a cosmetic problem — somebody clears a Saturday
     and drives two hours to an empty park. The view hides them anyway;
     this stops one being created at all, so the mistake is not available
     rather than merely corrected. */
  if (eventAt) {
    const when = new Date(eventAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'That date does not parse.' }, { status: 400 });
    }
    if (when.getTime() < Date.now() - 6 * 3600 * 1000) {
      return NextResponse.json(
        { error: 'That event has already happened. Nothing to post.' }, { status: 400 });
    }
  }

  /* Find or make the source. ⚠️ Matched case-insensitively on the label so
     "OCAAR" and "ocaar" don't become two sources with two hide switches. */
  const admin = adminClient();
  let { data: src } = await admin
    .from('content_sources').select('id').ilike('label', label).maybeSingle();

  if (!src) {
    const { data: made, error: srcErr } = await admin
      .from('content_sources')
      .insert({ label, kind: 'org', category: 'event', active: true,
                feed_url: url || 'https://www.ocaar.org/' })
      .select('id').single();
    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 400 });
    src = made;
  }

  let thumbPath = null;
  if (file && typeof file.arrayBuffer === 'function') {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'That image is too big.' }, { status: 400 });
    }
    const { default: sharp } = await import('sharp');
    /* ⚠️ .rotate() FIRST — it applies the EXIF orientation while the tag
       still exists. After the re-encode the tag is gone and a photo taken
       sideways stays sideways. Same ordering as the photo pipeline. */
    const webp = await sharp(buf).rotate()
      .resize(WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();

    thumbPath = `${src.id}/${crypto.randomUUID()}.webp`;
    const { error: upErr } = await admin.storage
      .from('content-thumbs')
      .upload(thumbPath, webp, { contentType: 'image/webp', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  /* ⚠️ external_id is required and unique per source. A flyer has no
     natural id, so the storage path doubles as one — and where there is
     no image, the title plus the date, which is as close to unique as an
     event gets. */
  const externalId = thumbPath || `${title}|${eventAt || 'evergreen'}`;

  const { error: insErr } = await admin.from('content_items').insert({
    source_id: src.id,
    external_id: externalId,
    title,
    url: url || 'https://www.ocaar.org/',
    /* ⚠️ NULL, deliberately. embed_id is what makes ContentCard render a
       player; a flyer has nothing to play, and a play button that does
       nothing is worse than no button. */
    embed_id: null,
    thumb_path: thumbPath,
    published_at: new Date().toISOString(),
    event_at: eventAt,
    place,
    /* 🔴 PINNED BY DEFAULT (0072). Ty: "everything i give you to post,
       make sure it starts at the beginning of the feed."

       ⚠️ Default, not forced — pass pin=no to post something that should
       just take its turn. But the default is the one that matches why
       this route exists: a thing posted BY HAND is a thing somebody
       decided mattered today, and burying it four posts down is how the
       first flyer went unseen for a day.

       Only one pin ever shows, so posting a second flyer quietly retires
       the first rather than stacking. No unpin step to remember. */
    pinned_at: String(form.get('pin') || 'yes') === 'no' ? null : new Date().toISOString(),
  });

  if (insErr) {
    /* Don't strand the upload if the row is refused. */
    if (thumbPath) await admin.storage.from('content-thumbs').remove([thumbPath]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, source: label, thumb: thumbPath });
}
