import '../theme-green.css';
import './slip.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import SlipView from './SlipView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meeting slips · Sober Book' };

/* =====================================================================
   /slip — MY MEETING SLIPS.  9 Nov 2026 (0203_meeting_slips).
   From the "Three new features" prototype. Reached from the check-in card
   on /meetings ("Need proof? Get a meeting slip").
   ===================================================================== */
export default async function SlipPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <>
      <div className="mast">
        <Link href="/meetings" className="back" aria-label="Back to meetings">←</Link>
        <span className="lg">meeting slips</span>
      </div>
      <SlipView />
    </>
  );
}
