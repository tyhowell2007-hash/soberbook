import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Inbox from './Inbox';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* ?to=handle — "Say hi" from the friends list, and anywhere else that
     wants to drop somebody straight into a conversation.

     ⚠️ Added because the friends page shipped with this link and nothing
     read it, so every "Say hi" quietly landed on the inbox instead. A
     link that goes to the right page but does the wrong thing is worse
     than a broken one: nothing errors, so nobody reports it.

     start_thread() is idempotent — it hands back the existing thread if
     there is one — so arriving here twice cannot create a duplicate. And
     it does all the refusing itself: no such handle, suspended, blocked
     either way, or yourself. If it refuses we just fall through to the
     inbox rather than showing an error, because every one of those
     reasons is one an error message must not distinguish between. */
  const to = typeof searchParams?.to === 'string' ? searchParams.to : null;
  if (to) {
    const { data: threadId } = await supabase.rpc('start_thread', { target_handle: to });
    if (threadId) redirect(`/chat/${threadId}`);
  }

  /* RULE 1 again: the view, never the table. Here it does more work than
     usual — chat_threads is what drops a conversation you ignored and a
     conversation with someone who blocked you. Read `threads` directly
     and you'd get both back, which is the whole feature undone. The
     database revokes SELECT on `threads` so that isn't possible, and
     assertReadable() says so out loud at the call site. */
  const { data: rows, error } = await supabase
    .from(assertReadable('chat_threads'))
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    /* 🔴 200, NOT 80 — 3 Sept. Ty has 133 threads and the list is
       ordered by recency, so a cap of 80 could silently drop the ONE
       conversation waiting on him into the part of the list that never
       arrives. The grouping below is only honest if it can see every
       row. ⚠️ If anybody ever passes 200, this becomes paging, not a
       bigger number. */
    .limit(200);

  /* THE DIRECTORY. public_profiles already does the hard part: it hides
     suspended accounts, hides anybody either of you has blocked, and
     nulls out identity for members in anonymous mode. So "everybody" here
     means everybody this particular person is allowed to see — which is
     not the same list for any two members, and that's correct. */
  const { data: people } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle, display_name, display_avatar, day_count, joined_at, last_public_post, is_mine')
    .order('joined_at', { ascending: false })
    .limit(200);

  const threads  = rows || [];
  /* 🔴 THIS COMMENT USED TO ARGUE AGAINST WHAT NOW SHIPS, AND BOTH HALVES
     OF IT HAD GONE WRONG — 3 Sept.

     It said: "'sent' means you reached out and they haven't answered. It
     lives with your open conversations, not in a lane of its own — a
     'waiting on them' section would be a scoreboard of people ignoring
     you."

     ⚠️ FIRST HALF, FACTUALLY DEAD. 0087 made chat_send_blocked() return
     false for everyone, so the view reports 'open' for every thread and
     'sent' can no longer occur. Measured: all 133 of Ty's threads.

     ⭐ SECOND HALF, STILL RIGHT, AND IT IS WHY THE GROUP IS COLLAPSED.
     The worry was a scoreboard — and it would be one, if 117 unanswered
     hellos were listed under a heading you had to scroll past every
     time. Inbox.jsx puts them behind a closed toggle, which is the
     opposite: the group exists to get them OFF the screen so the one
     conversation waiting on you is visible. Ty approved that shape from
     a mockup before it was built. If it is ever expanded by default,
     this objection comes straight back and it is correct. */
  const requests = threads.filter((t) => t.state === 'request');
  const inbox    = threads.filter((t) => t.state !== 'request');

  /* You're not in your own directory. start_thread() refuses to open a
     thread with yourself, so listing you would be a row that does
     nothing when tapped. */
  const members = (people || []).filter((p) => !p.is_mine);

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">chat</span>
      </div>
      <div className="bar">One to one · nobody else can read this</div>
      {/* The directory lists everyone, which is fine at five members
          and a problem at five hundred. Search is the way this scales. */}
      <div className="pad" style={{ paddingBottom: 0 }}>
        <Link href="/find" className="btn ghost">🔍 Find someone by name or handle</Link>
      </div>
      {error
        ? <div className="pad"><div className="err">Couldn&apos;t load chat: {error.message}</div></div>
        : <Inbox inbox={inbox} requests={requests} members={members} />}
    </>
  );
}
