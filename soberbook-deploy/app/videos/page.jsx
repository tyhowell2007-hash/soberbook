import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { signPhotoPaths } from '../../lib/sign-photos';
import VideoPlayer from './VideoPlayer';
import './videos.css';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE VIDEO PLAYER — recovery coins, piece 3.  31 Oct 2026 (0197).

   Ty saw "Prototype - Coins piece 3 - the video player" and said "i love
   it all".

   /videos              every video you can see, newest first
   /videos?v=<post>     the same list, opened at that video
   /videos?u=<handle>   one member's videos (their profile's Videos tab)

   🔴 TIME ORDER, ALWAYS. No trending, no "for you", no ranking by coins.
   A Day 9 video sits beside a Day 3,047 one because that is the order
   they were posted in.

   🔴 NOTHING HERE TOUCHES CLOUDFLARE. This page sends the browser a list
   of posts and our own drawn cards. The player URL is minted by
   /api/video/token only when somebody taps (StreamVideo's 23 Aug rule).
   Older videos that live in our own storage are signed here, the same
   way the wall signs them, and still do not load until the tap
   (preload="none" is never overridden).

   ⭐ Visibility is feed_posts's. Anonymous posts appear in the all-videos
   list exactly as they do on the wall (no name, no day), and never on a
   member's Videos tab, because feed_posts gives them no handle to match.
   ===================================================================== */

const COLS = 'id, body, created_at, is_mine, is_anonymous, author_handle, display_name, ' +
  'video_url, stream_uid, comment_count, seen_count, coin_words, ' +
  'support_count, strength_count, proud_count, metoo_count, coin_count, my_coin';

export default async function VideosPage({ searchParams }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const handle = typeof searchParams?.u === 'string' ? searchParams.u.slice(0, 40) : '';
  const start = typeof searchParams?.v === 'string' ? searchParams.v : '';

  let q = supabase
    .from(assertReadable('feed_posts'))
    .select(COLS)
    .or('stream_uid.not.is.null,video_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(60);
  if (handle) q = q.eq('author_handle', handle);
  const { data: rows } = await q;
  const videos = rows || [];

  /* The day count on the drawn card is the member's PUBLIC day count,
     wound back to the day they posted. If they keep their count private,
     public_profiles hands back null and the card shows the date instead. */
  const handles = [...new Set(videos.map((v) => v.author_handle).filter(Boolean))];
  const days = {};
  if (handles.length) {
    const { data: profs } = await supabase
      .from(assertReadable('public_profiles'))
      .select('handle, day_count')
      .in('handle', handles);
    (profs || []).forEach((p) => { if (p.day_count != null) days[p.handle] = Number(p.day_count); });
  }
  const now = Date.now();
  videos.forEach((v) => {
    const d = v.author_handle ? days[v.author_handle] : null;
    if (d != null) {
      const back = Math.floor((now - new Date(v.created_at).getTime()) / 86400000);
      v.day = d - back > 0 ? d - back : null;
    } else v.day = null;
  });

  const signed = await signPhotoPaths(supabase, videos.map((v) => v.video_url).filter(Boolean));
  videos.forEach((v) => { v.src = v.video_url ? signed[v.video_url] || null : null; });

  let title = 'Videos';
  if (handle) {
    const first = videos[0];
    title = first?.is_mine ? 'Your videos' : `@${handle}’s videos`;
  }

  return <VideoPlayer videos={videos} startId={start} title={title} back={handle ? `/u/${handle}` : '/wall'} />;
}
