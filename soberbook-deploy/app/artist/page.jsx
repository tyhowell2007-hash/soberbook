import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Artist from './Artist';

export const dynamic = 'force-dynamic';

/* =====================================================================
   /artist — apply for an artist profile, or edit yours.  19 Sept 2026.
   Musicians with a real following; Ty approves every one by hand in
   /admin/artists. The rules live in the database (0178): this page is
   only a form in front of artist_apply() and artist_update().
   ===================================================================== */
export default async function ArtistPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('handle').eq('id', user.id).maybeSingle();
  const { data: mine } = await supabase.rpc('artist_mine');

  return (
    <>
      <div className="mast">
        <Link href="/me" className="back" aria-label="Back to your page">←</Link>
        <span className="lg cvname">Artist profile</span>
      </div>
      <div className="bar">For musicians with a real following</div>
      <div className="pad">
        <Artist initial={mine || null} handle={me?.handle || ''} />
      </div>
    </>
  );
}
