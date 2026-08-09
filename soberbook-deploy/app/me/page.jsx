import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Me from './Me';

export const dynamic = 'force-dynamic';

/* Your own page. Deliberately small.

   NOT here, on purpose: themes, anthem, sponsor status, milestone chips,
   and other people's profiles. Every one of those is a good idea and every
   one of them would have delayed the sign-out button, which is a promise
   already made to 12 people. Ship the promise first. */
export default async function MePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, display_name, sober_since, privacy_mode, created_at, anthem_url, anthem_title, anthem_art, anthem_preview, anthem_youtube, autoplay_songs, lifetime_days, show_lifetime')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/welcome');

  /* Your own posts — WITHOUT ever asking the database "whose posts are
     these?". `is_mine` is computed inside the view by comparing author_id
     to auth.uid() and is the only ownership signal that ever reaches a
     browser. So this returns your anonymous posts too, and still never
     tells the client who wrote them.

     Doing this the obvious way — .eq('author_id', user.id) on the posts
     table — would work, and would quietly hand the browser the exact
     column the whole anonymity design exists to withhold. */
  const { data: mine } = await supabase
    .from(assertReadable('feed_posts'))
    .select('id, body, created_at, is_anonymous, comment_count')
    .eq('is_mine', true)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <Me
      email={user.email}
      profile={profile}
      posts={mine || []}
    />
  );
}
