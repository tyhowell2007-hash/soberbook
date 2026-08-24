import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { milestoneToday, dayCount } from '../../lib/milestones';
import { signPhotoPaths, collectPaths } from '../../lib/sign-photos';
import { fetchPreviews } from '../../lib/previews';
import Wall from './Wall';

export const dynamic = 'force-dynamic';

export default async function WallPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* display_name and avatar are read here so the welcome line and the
     "posting as" chip can say your name rather than your handle.

     ⚠️ This is YOUR OWN row, read straight from `profiles`, which is the
     one place that's always allowed — RLS scopes it to auth.uid(). It is
     never used to render anybody else; every other name on this page
     comes through the feed_posts view, which is what nulls the identity
     on anonymous posts. Two different sources on purpose. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, sober_since, display_name, avatar, milestones_answered, is_admin')
    .eq('id', user.id).maybeSingle();
  if (!profile) redirect('/welcome');

  // RULE 1: reads go through the view. assertReadable() makes the rule
  // visible here as well as enforced in the database.
  const { data: posts, error } = await supabase
    .from(assertReadable('feed_posts'))
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);

  /* Every photo on the page signed in ONE round trip, before render.
     ⚠️ Done here on the server rather than in the browser on purpose: a
     client-side pass would paint the wall, then fetch links, then pop the
     pictures in afterwards — the layout jumping under somebody's thumb
     while they read. Signed up front, a post arrives whole. */
  const photoUrls = await signPhotoPaths(supabase, collectPaths(posts));

  /* The last couple of replies under each post, fetched here rather than
     in the browser — same reason as the photos above. Loading them client
     side would paint the wall, then push every answered post downwards as
     its conversation appeared underneath, moving the page under somebody's
     thumb while they read it.

     ⚠️ ONE round trip for the whole page, not one per post. The obvious
     build asks per post as each card renders, which on a full wall is 60
     requests racing each other — and the first thing to break would be
     the wall of the person with the most conversation on it. */
  const previews = await fetchPreviews(supabase, (posts || []).map((p) => p.id));

  /* Something to look at, mixed in with what people wrote (0057).

     ⚠️ Read through feed_content, never content_items — the view is what
     drops hidden items and switched-off sources. Reading the base table
     would put something Ty pulled down straight back on the wall.

     Ordering and interleaving happen in lib/mix.js, not here: a plain
     `order by published_at` hands the whole wall to whichever channel
     uploads most, which the first real pull demonstrated within minutes. */
  const { data: content } = await supabase
    .from('feed_content')
    .select('id, title, url, embed_id, thumb_path, published_at, source_label, category, source_id')
    .order('published_at', { ascending: false })
    .limit(60);

  /* A member's own record (0058), keyed by post id.

     ⚠️ Read through feed_drops, never the `drops` table — the view is
     what returns media_path as NULL before the release time and withholds
     the outbound link during the exclusive window. Reading the base table
     would hand an unreleased master's file path to every browser on the
     wall, which is the one thing this whole feature promises not to do. */
  const { data: dropRows } = await supabase
    .from('feed_drops')
    .select('post_id, artist, title, kind, art_path, release_at, exclusive_hours, is_out, is_exclusive_now, exclusive_until, external_url, media_path')
    .in('post_id', (posts || []).map((p) => p.id));

  const drops = Object.fromEntries((dropRows || []).map((d) => [d.post_id, d]));

  /* Signed in the same pass as the photos. ⚠️ Only paths the VIEW handed
     back are here — an unreleased track never reaches this array, so it
     cannot accidentally be signed. */
  const dropUrls = await signPhotoPaths(
    supabase,
    (dropRows || []).flatMap((d) => [d.media_path, d.art_path]).filter(Boolean)
  );

  /* The public base for thumbnails. ⭐ Our bucket, not Google's — the
     puller copies every picture so a member's browser never calls
     i.ytimg.com just by scrolling. */
  const thumbBase =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-thumbs`;

  const days = profile.sober_since
    ? Math.floor((Date.now() - new Date(profile.sober_since).getTime()) / 86400000)
    : null;

  /* IS TODAY A MILESTONE, AND HAVE WE ALREADY ASKED?

     Decided on the SERVER, for one reason: the day boundary. dayCount and
     milestoneToday both work in UTC midnight, and doing this on the
     client would hand the answer to whatever timezone the phone is set
     to. Somebody in Ohio opening the app at 9pm would be told about
     tomorrow's milestone tonight — and having been told, would never be
     told again, because the offer only lands once.

     ⚠️ Nothing here has a branch for a broken streak, and that absence is
     the feature. milestoneToday() either finds a mark or returns null;
     there is no third case and there must never be one. */
  let mark = null;
  if (profile.sober_since) {
    const mk = milestoneToday(profile.sober_since);
    const answered = profile.milestones_answered || [];
    if (mk && !answered.includes(mk.key)) {
      mark = { key: mk.key, full: mk.full, days: dayCount(profile.sober_since) };
    }
  }

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        {/* The ♫ used to open a shared playlist — a page listing everyone's
            song. That was the wrong container: a song isn't a row in a
            directory, it's what's playing when you walk into someone's
            room. So it now opens YOUR page, where your song lives, and
            everyone else's lives on theirs. */}
        <Link href={`/u/${profile.handle}`} className="songlink"
              aria-label="Your page">♫</Link>
          {/* ⚠️ NOT A FIFTH TAB. The bottom bar opens with a note about why
              there are so few tabs, and search isn't a daily act — it's the
              thing you do once, when you've met somebody and want to find
              them again. It sits in the masthead with the other small links. */}
          <Link href="/find" className="songlink findlink"
                aria-label="Find someone">🔍</Link>
        {/* The day count was already here doing nothing. Making it the way
            into your own page means no new chrome on the masthead — the
            thing you look at anyway becomes the thing you tap. */}
        <Link href="/me" className="rt melink">
          {days !== null ? `day ${days}` : profile.handle} ›
        </Link>
      </div>
      <div className="bar">No steps to prove · no gaps to explain</div>
      {error
        ? <div className="pad"><div className="err">Couldn&apos;t load the wall: {error.message}</div></div>
        : <Wall
            initial={posts || []}
            me={{ name: profile.display_name || null, avatar: profile.avatar || null,
                  handle: profile.handle }}
            mark={mark}
            photoUrls={photoUrls}
            previews={previews}
            content={content || []}
            thumbBase={thumbBase}
            /* ⚠️ Passed as a plain boolean, not the profile row. The
               component only needs to know whether to render a control;
               handing it the whole profile invites it to start making
               other decisions from data it shouldn't be reading. */
            canHide={!!profile.is_admin}
            drops={drops}
            dropUrls={dropUrls}
          />}
    </>
  );
}
