import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import SpacesList from './SpacesList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Private spaces · Sober Book' };

/* =====================================================================
   /spaces — PRIVATE SPACES. 27 Nov 2026 (Kenny, drop 3b; Ty OK'd).

   Members-only rooms: the Women's Room and the LGBTQ+ Room. A door, not
   a sign: they live here, reached from For You, and only show up in the
   Rooms tab for people who joined.

   The rules (agreed 27 Nov):
   • Anyone can opt in. No proof asked.
   • Only members who joined can see the room or what's said in it. The
     database enforces it (room_wall, rooms policy, my_spaces()).
   • Anonymous by default: handles hidden, a room alias instead.
   • Moderation is the usual report button, with Ty and Kenny.
   ===================================================================== */
export default async function SpacesPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.rpc('my_spaces');

  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back to For You">←</Link>
        <span className="lg">private spaces</span>
      </div>
      <div className="bar">Members-only rooms. Only people who join can see them.</div>
      <div className="pad sp-pad">
        <SpacesList initial={Array.isArray(data) ? data : []} />
      </div>
    </>
  );
}
