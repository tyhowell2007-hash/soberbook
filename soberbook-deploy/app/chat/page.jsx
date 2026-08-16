import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Inbox from './Inbox';

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

  const threads = rows || [];
  /* 'sent' means you reached out and they haven't answered. It lives with
     your open conversations, not in a lane of its own — a "waiting on
     them" section would be a scoreboard of people ignoring you. */
  const requests = threads.filter((t) => t.state === 'request');
  const inbox    = threads.filter((t) => t.state !== 'request');

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">chat</span>
      </div>
      <div className="bar">One to one · nobody else can read this</div>
      {error
        ? <div className="pad"><div className="err">Couldn&apos;t load chat: {error.message}</div></div>
        : <Inbox inbox={inbox} requests={requests} />}
    </>
  );
}
