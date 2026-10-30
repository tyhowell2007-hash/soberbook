import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import Listings from './Listings';

export const dynamic = 'force-dynamic';

/* =====================================================================
   LISTING REPORTS  (/admin/listings) — 0193, 29 Oct 2026.

   What members sent from "Update this listing" on Find Care. Fixed marks
   the listing checked today, which is the date every card shows.

   ⚠️ There is no "who sent this" anywhere on this page, because the
   database never stored it. Not hidden: absent.

   ⚠️ 404 for everyone but Ty, same as /admin and /admin/numbers. And as
   there, this check is a convenience over a locked door, not the lock:
   listing_reports_queue() and resolve_listing_report() each run
   is_moderator() themselves.
   ===================================================================== */
export default async function ListingsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  const { data, error } = await supabase.rpc('listing_reports_queue');
  return <Listings initial={data || []} failed={!!error} />;
}
