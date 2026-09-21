import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../lib/supabase-admin';
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

  /* 0184: the look and the face come from the member's own row, because
     that is where they live — an artist page reads the same profile
     photo and the same cover and colour as everybody else's page. */
  const { data: me } = await supabase
    .from('profiles')
    .select('handle, avatar, avatar_photo, avatar_kind, cover, accent, sections')
    .eq('id', user.id)
    .maybeSingle();
  const { data: mine } = await supabase.rpc('artist_mine');

  /* ⚠️ Signed DIRECTLY, not through signPhotoPaths() — the same reason
     /me does it this way. That helper asks public_profiles whether a
     photo may be shown, and that view nulls it for anyone in anonymous
     mode; this page is not the public view. The path came out of their
     own row, read with their own session, so there is no other photo it
     could be. */
  let face = null;
  if (me?.avatar_photo && adminConfigured()) {
    const { data: signed } = await adminClient()
      .storage.from('avatars').createSignedUrl(me.avatar_photo, 3600);
    face = signed?.signedUrl || null;
  }

  return (
    <>
      <div className="mast">
        <Link href="/me" className="back" aria-label="Back to your page">←</Link>
        <span className="lg cvname">Artist profile</span>
      </div>
      <div className="bar">For musicians with a real following</div>
      <div className="pad">
        <Artist initial={mine || null} handle={me?.handle || ''} face={face}
                look={me ? { cover: me.cover, accent: me.accent, sections: me.sections } : null}
                emoji={me?.avatar || ''} photoPath={me?.avatar_photo || ''} />
      </div>
    </>
  );
}
