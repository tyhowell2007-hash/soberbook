import './share.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import { cardUrl, cardLabel, qrSvg } from '../../lib/share-card';
import ShareBits from './ShareBits';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Share my profile · Sober Book' };

/* =====================================================================
   /share — MY CARD, MY QR CODE.  1 Nov 2026 (0199).
   Ty saw it in the "Wall Upgrade" prototype and said "build that now with
   the QR code." Reached from the wall ("Share my profile ↗" under Welcome
   home) and from the ☰ menu.
   ===================================================================== */
export default async function SharePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.rpc('my_share_card');
  if (!me?.handle) redirect('/wall');
  const svg = await qrSvg(cardUrl(me.handle));
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">share</span>
      </div>
      <div className="shc">
        <h1 className="sh-h">Share my profile</h1>
        <p className="sh-sub">Let someone scan it at a meeting, or send the link.</p>
        <ShareBits me={me} svg={svg} url={cardUrl(me.handle)} label={cardLabel(me.handle)} />
      </div>
    </>
  );
}
