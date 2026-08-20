import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Friends from './Friends';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your people — Sober Book' };

/* Your people.

   Two calls, both of which return only what belongs to the person asking:
   my_friends() and my_friend_requests() are SECURITY DEFINER and read
   current_uid() themselves. There is no handle parameter on either, so
   this page cannot be pointed at somebody else's list — not by editing
   the URL, not by any request a browser could make. The absence of that
   parameter IS the access control. */
export default async function FriendsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: friends }, { data: reqs }] = await Promise.all([
    supabase.rpc('my_friends'),
    supabase.rpc('my_friend_requests'),
  ]);

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/find" className="rt melink">find someone ›</Link>
      </div>
      <div className="bar">Your people</div>
      <div className="pad">
        <Friends initialFriends={friends || []} initialRequests={reqs || []} />
      </div>
    </>
  );
}
