import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import PlanForm from './PlanForm';

export const dynamic = 'force-dynamic';

/* =====================================================================
   YOUR PLAN — the seven things, written before you need them.  7 Sept.
   Migration 0146. See it for why this table is the most carefully
   locked-down thing in the schema.

   ⭐ THE POINT IS THAT /now READS THIS BACK. Nothing on this page is
   for this page. It exists so that at 3am the app can hand somebody
   their own three sentences instead of a breathing exercise written by
   a stranger.

   ⚠️ SO THE ORDER OF THE QUESTIONS IS NOT THE ORDER OF THE ANSWERS.
   Here they run in the order they are easiest to think about on a calm
   afternoon — triggers, signs, what works. On /now they are shown in
   the order they are useful in a bad ten minutes — what works first,
   who to call second. Two different jobs, two different orders, and
   the same seven fields.
   ===================================================================== */

export const metadata = {
  title: 'Your plan · Sober Book',
  robots: { index: false, follow: false },
};

export default async function PlanPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* Server-fetched so the boxes arrive filled. A form that flashes
     empty and then fills in is a form somebody starts retyping. */
  let plan = null;
  try {
    const { data } = await supabase.rpc('my_plan');
    plan = Array.isArray(data) ? data[0] : data;
  } catch { /* an empty form is still a usable form */ }

  return <PlanForm initial={plan || null} />;
}
