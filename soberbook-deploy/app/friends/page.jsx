import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import { signPhotoPaths, collectPaths } from '../../lib/sign-photos';
import RoomSwitch from './RoomSwitch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The rooms — Sober Book' };

/* =====================================================================
   THE ROOMS — and nothing else, since 29 Sept 2026.

   Ty, looking at it on his phone: "Everything needs to be in that one
   window. You can even stretch it down further if you want. We don't need
   all those contacts below it. We can make this whole page just for
   streaming talk."

   ⚠️ WHAT THIS PAGE USED TO ALSO BE, AND WHERE IT WENT.
   <Friends> lived under the room and carried four things. Every one of
   them still has a home, and I checked each before pulling it out rather
   than after:

     the directory of everybody ..... chat/Directory.jsx renders the SAME
                                      component off the SAME query. It was
                                      always in two places (0046 → 0049).
     friend requests ................ a request writes a notification, and
                                      notifications/Rows.jsx sends a
                                      'friend' row to /u/<handle>, where
                                      FriendButton.jsx has Accept and
                                      Ignore. The list was a second way in,
                                      never the only one.
     "It's been a while" ............ gone. It was a nudge to go and talk
                                      to somebody, on a page that is now
                                      the talking.
     "Coming up" milestones ......... gone from here; the same chips render
                                      on the wall and on a profile.

   🔴 AND THE DOT WENT WITH IT. BottomNav lit People for "someone asked to
   be your friend". Its own comment says never leave a dot burning with
   nothing behind it — so that key is removed in the same change, not
   later. A dot that opens a chat room when somebody asked to be your
   friend is worse than no dot.

   ⚠️ TWO QUERIES LEFT WITH IT — my_friends() and my_friend_requests().
   community_members() stays, because the room's header counts it.
   ===================================================================== */
export default async function FriendsPage({ searchParams }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: people }, { data: roomList }] = await Promise.all([
    /* ⭐ Only for the number in the room's header. It returns every live
       profile including you, so it is the size of the room rather than the
       number of other people — which is what "414 members" should mean.

       ⚠️ Counted from a list the page already has. A second query for a
       number that is already in hand is how two parts of a screen start
       disagreeing. */
    supabase.rpc('community_members'),
    /* ⭐ EVERY open room, not one by slug (0097 opened The Front Porch).
       `sort` decides the order of the tabs, so opening a third room stays
       what 0092 promised: an INSERT, with no code change here.

       ⚠️ `anonymous` comes along because the composer and the ⋯ menu both
       behave differently in a room that hides handles — and the component
       must be told, never left to infer it from whether a handle happens
       to be null on the messages it can see. */
    supabase.from('rooms').select('id, slug, emoji, name, blurb, anonymous')
            .eq('active', true).order('sort').order('created_at'),
  ]);

  const rooms = roomList || [];

  /* ⭐ ?room=<slug> — THE ROOM HAS AN ADDRESS, 3 Sept.
     ---------------------------------------------------------------------
     Found the night the Kratom 7-OH room was added, and it made that room
     pointless as built: RoomSwitch holds the active tab in useState, so
     there was NO URL that opened anything but the first room. The whole
     reason 7-OH exists is that a creator is going to post a link to it —
     and a link to it could not be written.

     ⚠️ RESOLVED ON THE SERVER, NOT IN RoomSwitch, and the difference is
     not stylistic. page.jsx fetches `firstMessages` for whichever room it
     calls `first`, so picking the room here means the requested room
     arrives WITH ITS MESSAGES ALREADY IN IT. Doing it client-side would
     open the right tab onto an empty panel and then go fetch — the room
     would flash "nobody's said anything yet" at exactly the person who
     followed a link because they needed somebody.

     ⚠️ And it avoids useSearchParams entirely: that needs a Suspense
     boundary, and reading window.location in a useState initializer
     desynchronises server and client render.

     ⚠️ An unknown, misspelled or switched-off slug falls back to the
     Front Room rather than erroring. `rooms` only holds active rooms, so
     a link to a room Ty has turned off degrades to the front door — the
     right failure for a URL that may be printed on somebody else's post
     long after we change our minds. */
  const wanted = typeof searchParams?.room === 'string' ? searchParams.room : null;
  const room   = (wanted && rooms.find((r) => r.slug === wanted)) || rooms[0] || null;

  /* The last 60, oldest at the bottom the way a conversation reads.
     ⚠️ room_wall, never room_messages — the base table is revoked from
     members and the view is where a block is applied in both directions.
     ⚠️ Guarded: if the room row is ever missing the page must still
     render rather than 500.
     ⭐ ONLY THE FIRST ROOM IS PRELOADED. The others fetch when you open
     them — a second room is a tab most people will never tap, and paying
     for its messages on every single page load would make this page
     slower for everybody to serve a minority. Room.jsx knows to go and
     get them when it is handed nothing. */
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
     `limit(1)` because we want to know IF, never how many. */
  let spokenHere = true;
  if (room) {
    const { data: spoke } = await supabase
      .from(assertReadable('room_wall'))
      .select('id').eq('room_slug', room.slug).eq('is_mine', true).limit(1);
    spokenHere = (spoke || []).length > 0;
  }

  /* Your own handle, so a message you just sent can be labelled without
     another round trip. ⚠️ public_profiles, not profiles. */
  const { data: mine } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle').eq('is_mine', true).maybeSingle();

  /* ⚠️ .roomscreen IS THE WHOLE LAYOUT. It makes this page one column the
     height of the window — masthead, strip, tabs, then the room takes
     everything that is left — so the composer never leaves the bottom of
     the screen and nothing scrolls but the conversation. friends.css
     carries the reasoning, including why it pays for the fixed nav bar
     itself rather than letting .navpad do it.

     ⚠️ The way OUT of here has not changed and must not: ← goes to the
     wall, "find someone" goes to /find, and the bar underneath is the
     same bar as everywhere else. A page that looks different is a choice;
     navigation that looks different is a bug. */
  return (
    <div className="roomscreen">
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/find" className="rt melink">find someone ›</Link>
      </div>
      <div className="bar">Everybody here · say anything</div>
      <div className="pad">
        {room ? (
          <RoomSwitch rooms={rooms} first={room} firstMessages={firstMessages}
                      meHandle={mine?.handle || 'you'}
                      members={(people || []).length} signed={roomPhotos}
                      spokenHere={spokenHere} />
        ) : (
          /* ⚠️ Not a blank page. `rooms` only holds active rooms, so this
             is what a member sees if every room is ever switched off. */
          <p className="hint">The rooms are closed just now. Try again in a bit.</p>
        )}
      </div>
    </div>
  );
}
