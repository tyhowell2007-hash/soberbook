import { redirect, notFound } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import Convo from './Convo';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* One query, and it is also the authorisation check.

     There is no "am I allowed to see this thread?" line anywhere in this
     file, and that's deliberate: chat_threads only ever contains rows you
     are in. A thread you were never part of, one you ignored, one with
     somebody who blocked you — all of them come back as no row, and no
     row is a 404. Permission checks written in application code are the
     ones that get forgotten on the next page; this one cannot be. */
  const { data: t } = await supabase
    .from(assertReadable('chat_threads'))
    .select('*').eq('id', params.id).maybeSingle();
  if (!t) notFound();

  const { data: msgs } = await supabase
    .from(assertReadable('chat_messages'))
    .select('*').eq('thread_id', params.id)
    .order('created_at', { ascending: true }).limit(200);

  return <Convo thread={t} initial={msgs || []} />;
}
