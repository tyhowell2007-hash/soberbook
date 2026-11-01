import { notFound, permanentRedirect } from 'next/navigation';
import { base, db } from '../../../../lib/rm/server';

/* Old RecoveryMap links were /centers/102168. The ids carried over, so
   every bookmark and every line of the old 19,559-address sitemap still
   lands on the right place. */
export default async function OldLink({ params }) {
  const r = await db().rpc('rm_slug_for_id', { p_id: String(params.id).replace(/\D/g, '') });
  if (!r.data) notFound();
  const c = await db().rpc('rm_center', { p_slug: r.data });
  if (!c.data) notFound();
  const st = String(c.data.state).toLowerCase();
  const city = String(c.data.city).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  permanentRedirect(`${base()}/${st}/${city}/${r.data}`);
}
