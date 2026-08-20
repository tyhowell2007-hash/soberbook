import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Numbers from './Numbers';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE NUMBERS.

   Ty asked for a live user count: "no names just numbers."

   ---------------------------------------------------------------------
   ⚠️ THE SECOND HALF OF THAT SENTENCE IS THE SECURITY MODEL, NOT A
   PREFERENCE.

   With five members, "1 member has never posted" sitting next to a list
   of names identifies that person instantly. So there is no list here —
   not hidden, not collapsed, not one tap away. owner_stats() returns
   integers and there is deliberately no version of it that takes a
   filter or returns a sample row. If you ever want to know WHO, that is
   a different question and it needs a different conversation about
   whether Ty should be able to ask it.

   ⚠️ 404, not "you're not allowed" — same call as /admin. A polite
   refusal confirms the route is real and worth attacking.

   And as on /admin: this check is a convenience over a locked door, not
   the lock. owner_stats() runs its own admin check inside itself,
   because it's a SECURITY DEFINER function and those bypass RLS
   entirely. Delete this file and the numbers are still safe.
   ===================================================================== */
export default async function NumbersPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  /* Fetched once on the server so the page has numbers the instant it
     paints, then the client keeps them fresh. The alternative — an empty
     page that fills in a second later — makes every load look broken. */
  const { data } = await supabase.rpc('owner_stats');

  return <Numbers initial={data || null} />;
}
