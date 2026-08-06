import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Songs from './Songs';

export const dynamic = 'force-dynamic';

/* The shared playlist.

   Reads member_songs, never `profiles`. The view is the only thing in this
   app that shows a member something about another member, and it hands
   back exactly five fields: name, url, title, is_mine, joined_at. No
   profile id, no sober date, no privacy mode.

   That last omission is the important one — telling you WHO is anonymous
   is itself the leak, so the view simply names everyone the same way the
   Wall does and says nothing about which mode they're in. */
export default async function SongsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('handle').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/welcome');

  const { data: songs, error } = await supabase
    .from('member_songs')
    .select('display_name, anthem_url, anthem_title, is_mine, joined_at')
    .order('joined_at', { ascending: true });

  if (error) {
    return (
      <div className="pad">
        <div className="err">Couldn&apos;t load the playlist: {error.message}</div>
      </div>
    );
  }

  return <Songs songs={songs || []} />;
}
