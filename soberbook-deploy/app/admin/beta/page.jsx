import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Board from './Board';
import '../../beta/beta.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Beta testers', robots: { index: false, follow: false } };

/* =====================================================================
   /admin/beta — Kenny's beta (0206). Ty and Kenny only (404 for anyone
   else). Invite a current member by @handle (the card shows on their
   wall), add a newcomer once they've signed up, and read the counts-only
   report. Every button calls a database function that checks is_admin
   again, so this page cannot do anything the database wouldn't allow.
   ===================================================================== */
export default async function BetaAdmin() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) notFound();
  return <Board />;
}
