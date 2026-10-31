import { redirect } from 'next/navigation';
import { serverClient } from '../../../../lib/supabase-server';

/* =====================================================================
   "HOW IT'S DOING" — the shared loader for both addresses.  31 Oct (0196).

   /p/<id>/stats         — the whole page
   /p/<id>/stats/coins   — the same page, opened at the coins (where a
                           coin notification lands)

   ⚠️ Two plain folders, not one [[...section]] catch-all: GitHub's web
   uploader refuses any path containing "...", so the catch-all never
   reached the repo on the first upload. Same page, safer folder names.

   🔴 post_stats() decides who may see this, in the database: null for
   anybody who is not the post's author, and null sends you to the post
   itself — so the page cannot be used to test whose post an id is.
   ===================================================================== */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadStats(params) {
  const id = String(params?.id || '');
  if (!UUID.test(id)) redirect('/wall');
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: stats, error } = await supabase.rpc('post_stats', { p_post: id });
  if (error || !stats) redirect(`/p/${id}`);
  return { id, stats };
}
