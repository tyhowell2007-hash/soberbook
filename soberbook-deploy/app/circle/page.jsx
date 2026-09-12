import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Circle from './Circle';

export const dynamic = 'force-dynamic';

/* ⚠️ Auth is checked here and the component is left to fetch its own
   data on the client. A circle is small and cheap to read, and doing it
   client-side means Send can refresh the room without a page navigation. */
export default async function CirclePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <div className="pad"><Circle /></div>;
}
