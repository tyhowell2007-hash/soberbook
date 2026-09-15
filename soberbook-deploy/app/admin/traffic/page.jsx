import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Traffic from './Traffic';

export const dynamic = 'force-dynamic';

/* =====================================================================
   TRAFFIC — the server half.

   Same gate as /admin and /admin/numbers, and the same reasoning: the
   check here is a convenience over a locked door, not the lock. The
   route at /api/admin/traffic runs its own identical check, because
   deleting this file must not be a way in.

   ⚠️ NOTHING IS FETCHED HERE. /admin/numbers fetches once on the server
   so the page paints with numbers already on it, and that is right for a
   handful of integers from one RPC. This page needs five counts and five
   30-day series, and doing that during render would hold the HTML
   response open for the length of the slowest query — a page that takes
   three seconds to show anything reads as broken long before it reads as
   thorough. The client asks the instant it mounts and shows its own
   "reading…" state, which is honest about what is happening.
   ===================================================================== */
export default async function TrafficPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) notFound();

  return <Traffic />;
}
