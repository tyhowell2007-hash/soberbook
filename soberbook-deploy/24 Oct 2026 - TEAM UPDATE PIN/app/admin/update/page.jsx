import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import Update from './Update';

export const dynamic = 'force-dynamic';

/* =====================================================================
   POSTING THE TEAM'S PINNED NOTE. 24 Oct (0191).

   ⚠️ notFound(), not "you are not allowed" — the /admin convention. A
   polite refusal confirms the route is real and worth attacking.

   ⚠️ And this check is a convenience over a locked door, not the lock.
   post_team_update() and clear_team_update() both call is_moderator()
   themselves. Delete this file and nobody can still post one.
   ===================================================================== */
export default async function TeamUpdatePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) notFound();

  /* What is pinned right now, read through the same view the wall reads
     — so this screen cannot disagree with what members are looking at.
     ⚠️ Tolerant of the view not existing, for the reason written out at
     length in app/wall/page.jsx: a screen that 500s because a migration
     has not run yet teaches nobody anything useful. */
  let live = null;
  try {
    const { data } = await supabase
      .from('live_team_update').select('id, body, created_at').maybeSingle();
    live = data || null;
  } catch { /* the component says so plainly */ }

  return (
    <>
      <div className="mast">
        <Link href="/admin/numbers" className="back"
              aria-label="Back to the numbers">←</Link>
        <span className="lg cvname">Team update</span>
      </div>
      <div className="bar">The note pinned above everybody’s wall</div>
      <div className="pad">
        <Update live={live} />
      </div>
    </>
  );
}
