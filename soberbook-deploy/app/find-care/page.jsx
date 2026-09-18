import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../lib/supabase-server';
import FindCare from './FindCare';

/* =====================================================================
   FIND CARE — the treatment and recovery-housing directory.

   Dr. Nicole Labor gave Sober Book her RecoveryMap directory in Sept
   2026 and asked for it to live inside the app. This is that.

   ⚠️ BEHIND THE LOGIN, and the reason is NOT the reason /meetings is.
   Meetings are gated because publishing live Zoom links makes a
   harvesting surface. Nothing here is harvestable — it is SAMHSA-derived
   public data. This is gated because every read path in the app is a
   SECURITY DEFINER function that bails on a NULL caller, and carving out
   an exception is how the next table gets it wrong.

   ⭐ WORTH REVISITING WITH TY: a PUBLIC version of this page is the
   single best SEO asset Sober Book could have — 19,490 towns' worth of
   "treatment near me", pointing at an app that refuses paid referrals.
   That is a product decision, not a technical one, so it is not made
   here.
   ===================================================================== */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Find care — Sober Book',
  robots: { index: false, follow: false },
};

export default async function FindCarePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* The snapshot date, read once on the server. ⚠️ If this query fails
     the page still renders — the date becomes "recently", which is vague
     but true, rather than taking down a page somebody needs. */
  let snapshot = 'recently';
  try {
    const { data } = await supabase.rpc('center_snapshot');
    if (data) {
      snapshot = new Date(data + 'T12:00:00').toLocaleDateString('en-US',
        { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch { /* leave it as 'recently' */ }

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/wall" className="back">←</Link>
      </div>
      <div className="bar">FIND CARE</div>
      <div className="pad">
        <FindCare snapshot={snapshot} />
      </div>
    </>
  );
}
