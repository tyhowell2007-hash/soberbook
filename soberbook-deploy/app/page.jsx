import { redirect } from 'next/navigation';
import { serverClient } from '../lib/supabase-server';

export default async function Home() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // A signed-in user without a profile row hasn't finished first run.
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('id', user.id).maybeSingle();

  redirect(profile ? '/wall' : '/welcome');
}
