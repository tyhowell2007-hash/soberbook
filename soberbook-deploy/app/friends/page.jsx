import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
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

  /* ⭐ EVERYBODY, NOT JUST YOUR PEOPLE.

     Ty, Aug 25: "people are asking me how many people are on here because
     they can't see everybody… we want everybody to interact with
     everybody. That's how this ecosystem works."

     🔴 The list of everyone ALREADY EXISTED — app/chat/Directory.jsx, whose
     own header says "EVERYBODY". It was inside the Chat tab. Meanwhile the
     tab actually labelled **People** rendered "Nobody yet." to anyone
     without friends, which was five of seven members. **The tab called
     People told you there were no people.** Eighth time this month
     something was fully built with no way in, and the only one that
     asserted the opposite of the truth rather than merely hiding it.

     ⚠️ SAME QUERY AS chat/page.jsx, AND THE SAME COMPONENT RENDERS IT.
     Not a second member list — a second mount of the first one. Two
     implementations of "who can this person see" is exactly the drift
     0046 → 0049 → 0072 kept punishing us for.

     public_profiles does the hard part: hides suspended accounts, hides
     anybody either of you has blocked, and nulls identity for members in
     anonymous mode. "Everybody" is therefore a different list for every
     member, which is correct. */
  const [{ data: friends }, { data: reqs }, { data: people }] = await Promise.all([
    supabase.rpc('my_friends'),
    supabase.rpc('my_friend_requests'),
    supabase
      .from(assertReadable('public_profiles'))
      .select('handle, display_name, display_avatar, day_count, joined_at, last_public_post, is_mine')
      .order('joined_at', { ascending: false })
      .limit(200),
  ]);

  /* You are not in your own directory — start_thread() refuses a thread
     with yourself, so your row would do nothing when tapped. And people
     already in your list above aren't repeated underneath. */
  const known = new Set((friends || []).map((f) => f.handle));
  const everyone = (people || []).filter((x) => !x.is_mine && !known.has(x.handle));

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/find" className="rt melink">find someone ›</Link>
      </div>
      <div className="bar">Everybody here · say hi to anyone</div>
      <div className="pad">
        <Friends initialFriends={friends || []} initialRequests={reqs || []}
                 everyone={everyone} />
      </div>
    </>
  );
}
