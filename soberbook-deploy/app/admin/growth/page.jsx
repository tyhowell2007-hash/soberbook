import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Growth from './Growth';

export const dynamic = 'force-dynamic';

/* =====================================================================
   GROWTH & RETENTION.  18 Sept 2026.

   Same gate as /admin/numbers, for the same reasons:
   ⚠️ 404, not "you're not allowed" — a polite refusal confirms the route
   is real and worth attacking.
   ⚠️ And this check is a convenience over a locked door, not the lock.
   owner_growth() runs its own admin check inside itself and refuses a
   NULL caller. Delete this file and the numbers are still safe.

   🔴 NUMBERS ONLY, like /admin/numbers. No names, no ids, no "show me
   who". owner_growth() has no version that returns a person.
   ===================================================================== */
const LAUNCH = '2026-08-03';

export default async function GrowthPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  /* First paint has numbers on it — same reasoning as /admin/numbers. */
  const { data } = await supabase.rpc('owner_growth', {
    p_from: LAUNCH, p_to: to, p_segment: 'all',
  });

  return <Growth initial={data || null} launch={LAUNCH} today={to} />;
}
