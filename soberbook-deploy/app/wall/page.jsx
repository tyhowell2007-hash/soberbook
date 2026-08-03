import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Wall from './Wall';

export const dynamic = 'force-dynamic';

export default async function WallPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('handle, sober_since').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/welcome');

  // RULE 1: reads go through the view. assertReadable() makes the rule
  // visible here as well as enforced in the database.
  const { data: posts, error } = await supabase
    .from(assertReadable('feed_posts'))
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);

  const days = profile.sober_since
    ? Math.floor((Date.now() - new Date(profile.sober_since).getTime()) / 86400000)
    : null;

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">{days !== null ? `day ${days}` : profile.handle}</span>
      </div>
      <div className="bar">No steps to prove · no gaps to explain</div>
      {error
        ? <div className="pad"><div className="err">Couldn&apos;t load the wall: {error.message}</div></div>
        : <Wall initial={posts || []} />}
    </>
  );
}
