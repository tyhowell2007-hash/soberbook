import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import Banners from './Banners';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Banner test · Sober Book' };

/* =====================================================================
   /admin/banners — Jesse's banner test (0208, 20 Nov 2026).
   The weekly numbers against the plan's definitions, the answers to the
   question banner (no names, ever), and the on/off switches.
   ⚠️ notFound() for non-admins, the /admin convention. The real lock is
   is_moderator() inside every banner_*_admin() function.
   ===================================================================== */
export default async function BannerTestPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) notFound();

  return (
    <>
      <div className="mast">
        <Link href="/admin/numbers" className="back" aria-label="Back to the numbers">←</Link>
        <span className="lg cvname">Banner test</span>
      </div>
      <div className="bar">Jesse&apos;s plan: numbers, answers, switches</div>
      <div className="pad">
        <Banners />
      </div>
    </>
  );
}
