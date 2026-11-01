import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Talk from './Talk';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TalkPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!UUID.test(params.id || '')) redirect('/talks');

  const { data: state } = await supabase.rpc('talk_state', { p_talk: params.id });
  if (!state || state.gone) redirect('/talks');

  return <Talk id={params.id} initial={state} />;
}
