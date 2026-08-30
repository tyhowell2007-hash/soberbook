import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { signPhotoPaths, collectPaths } from '../../lib/sign-photos';
import Friends from './Friends';
import Room from './Room';

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
  /* 🛋️ The room, fetched here so the page arrives with the conversation
     already in it rather than popping in a beat later. Same reasoning as
     signing the Wall's photos server-side.

     ⚠️ ONE room, by slug, on purpose. The schema holds many (0092) and
     opening "🌙 Late night" later is an INSERT — but 18 members split
     across several rooms means several EMPTY rooms, and an empty room
     says "this place is dead" louder than no room at all. The agreed
     trigger for a second one is 20+ messages a day from 6+ people. */
  const [{ data: friends }, { data: reqs }, { data: people }, { data: room }] = await Promise.all([
    supabase.rpc('my_friends'),
    supabase.rpc('my_friend_requests'),
    /* ⭐ community_members() rather than the raw view, for two reasons.

       It orders by whoever you have NEVER spoken to first, which is the
       point of the page now — meeting people, not revisiting the ones you
       already talk to.

       And it returns EVERY live profile, anonymous members included. Ty,
       Aug 29: "Even if they're anonymous, they go in there as well. That
       way it forces everybody to see who's all on here." The view already
       nulls an anonymous member's name, emoji and photo, so they arrive
       as a bare handle — present, greetable, unidentified.

       ⚠️ day_count and last_public_post are JOINED from public_profiles
       inside that function (0088) rather than recomputed, so the
       can-you-see-this rules have exactly one implementation. An earlier
       version of this comment claimed the function withheld day_count
       entirely and that this was the safety story. That was true for
       about an hour and is not the design: the real protection is in
       chipFor() in chat/Directory.jsx, which refuses to print a raw
       "Day 3" under 30 days on ANY list. Withholding the column here
       would only have protected this one page while the identical
       component in Chat kept rendering it — the 0046 → 0049 drift, with
       a safety property riding on it. */
    supabase.rpc('community_members'),
    supabase.from('rooms').select('id, slug, emoji, name, blurb')
            .eq('slug', 'front-room').maybeSingle(),
  ]);

  /* The last 60, oldest at the bottom the way a conversation reads.
     ⚠️ room_wall, never room_messages — the base table is revoked from
     members and the view is where a block is applied in both directions.
     ⚠️ maybeSingle above and this whole block guarded: if the room row is
     ever missing the page must still render the people, not 500. */
  let firstMessages = [];
  let roomPhotos = {};
  if (room) {
    const { data: rows } = await supabase
      .from(assertReadable('room_wall'))
      .select('id, body, photo_urls, edited_at, created_at, is_mine, handle, display_name, display_avatar')
      .eq('room_slug', room.slug)
      .order('created_at', { ascending: false })
      .limit(60);
    firstMessages = (rows || []).slice().reverse();

    /* ⚠️ Signed HERE rather than by the browser after it mounts. Two
       reasons, and only the first is speed: the pictures arrive with the
       page instead of popping in a beat later, and — the one that
       matters — signPhotoPaths() needs the service role key, which lives
       on the server and must never reach a browser.

       ⭐ It queries room_wall AS THIS MEMBER, so a photo from somebody
       they have blocked is simply absent from the answer. No rule about
       blocks is written here or in sign-photos.js; the view already
       knows, and we ask instead of deciding. */
    roomPhotos = await signPhotoPaths(supabase, collectPaths(firstMessages));
  }

  /* Have they ever said anything in here?
     ⭐ Asked of room_wall with `is_mine`, NOT derived from the 60 messages
     above — somebody who spoke last week and has scrolled off would
     otherwise be told they had never spoken and shown a welcome nudge
     for the second time.

     ⚠️ And NOT taken from community_members().never_spoken, which is the
     answer to a different question: that one measures posts and replies
     on the Wall (0089) and knows nothing about the room. Two similar
     sounding fields, two different meanings — using the wrong one here
     would hide the nudge from exactly the people it exists for.

     `limit(1)` because we want to know IF, never how many. */
  let spokenHere = true;
  if (room) {
    const { data: mine } = await supabase
      .from(assertReadable('room_wall'))
      .select('id').eq('room_slug', room.slug).eq('is_mine', true).limit(1);
    spokenHere = (mine || []).length > 0;
  }

  /* Your own handle, so a message you just sent can be labelled without
     another round trip. ⚠️ public_profiles, not profiles. */
  const { data: mine } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle').eq('is_mine', true).maybeSingle();

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
      <div className="bar">Everybody here · say anything</div>
      <div className="pad">
        {room && (
          <Room room={room} initial={firstMessages} meHandle={mine?.handle || 'you'}
                /* community_members() returns every live profile INCLUDING
                   you, so this is the size of the room, not the number of
                   other people. ⚠️ Counted from the same list the page
                   already has — a second query for a number that is
                   already in hand is how two parts of a screen start
                   disagreeing. */
                members={(people || []).length} signed={roomPhotos}
                spokenHere={spokenHere} />
        )}
        <Friends initialFriends={friends || []} initialRequests={reqs || []}
                 everyone={everyone} />
      </div>
    </>
  );
}
