import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Inbox from './Inbox';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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
    .limit(80);

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
  /* 'sent' means you reached out and they haven't answered. It lives with
     your open conversations, not in a lane of its own — a "waiting on
     them" section would be a scoreboard of people ignoring you. */
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
