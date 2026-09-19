import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Artists from './Artists';

export const dynamic = 'force-dynamic';

/* =====================================================================
   ARTIST APPLICATIONS.  19 Sept 2026.  Owner only.
   Same gate as /admin/growth: a 404 for anyone else, and the gate is a
   convenience over the lock — artist_queue() and artist_decide() check
   is_admin themselves and refuse a NULL caller.
   ===================================================================== */
export default async function ArtistsAdminPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: mod } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  const { data } = await supabase.rpc('artist_queue');

  return (
    <>
      <div className="mast">
        <Link href="/admin/numbers" className="back" aria-label="Back to the numbers">←</Link>
        <span className="lg cvname">Artists</span>
      </div>
      <div className="bar">Applications and verified artists</div>
      <div className="pad">
        <Artists initial={data || { pending: [], approved: [] }} />
      </div>
    </>
  );
}
