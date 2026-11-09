import '../../theme-green.css';
import '../../slip/slip.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import SignView from './SignView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign a meeting slip · Sober Book', robots: { index: false } };

/* =====================================================================
   /sign/<code> — THE CHAIR'S SIDE.  9 Nov 2026 (0203).
   The chair lands here by pointing their phone camera at a member's slip
   QR. Signed in only (the middleware sends strangers to /login).
   🔴 Shows the meeting and the day — never who the slip belongs to.
   ===================================================================== */
export default async function SignPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const token = String(params.token || '').slice(0, 64);
  return (
    <>
      <div className="mast">
        <Link href="/meetings" className="back" aria-label="Back to meetings">←</Link>
        <span className="lg">sign a slip</span>
      </div>
      <SignView token={token} />
    </>
  );
}
