import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import SongPlayer from '../../components/SongPlayer';

export const dynamic = 'force-dynamic';

/* Somebody else's page.

   This is the first screen in Sober Book where one member reads another
   member's profile, so everything it knows comes from ONE view —
   public_profiles — and that view decides what a stranger may see. There
   is no second query here quietly topping up the data, and there should
   never be one.

   WHAT THIS PAGE CANNOT DO, BY CONSTRUCTION:
     • It has no profile id, so it cannot join this person to anything.
     • It has no sober date, only a count.
     • It has no privacy_mode, so it cannot tell you who is anonymous.

   The last one is worth sitting with. If this page could say "this member
   posts anonymously", then anyone could check a handle and learn which
   posts on the Wall to go looking through. So it doesn't know, and the
   name it shows is produced by the same expression the Wall uses. */
export default async function ProfilePage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const handle = decodeURIComponent(params.handle || '');

  /* Match on the lowercased copy the view provides.
     NOT .ilike() — a handle may contain an underscore, and an underscore
     is a wildcard in LIKE patterns, so `ty_howell` would also match
     `tyXhowell`. Two plain strings, compared. See 0008. */
  const { data: p } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle, display_name, display_avatar, day_count, ' +
            'anthem_url, anthem_title, anthem_art, anthem_preview, is_mine, joined_at')
    .eq('handle_key', handle.toLowerCase())
    .maybeSingle();

  /* No row means: no such handle, OR suspended, OR one of you blocked the
     other. All three land here and look identical on purpose. A page that
     said "you are blocked" would confirm the account exists and that
     somebody took action — an error message is an output channel. */
  if (!p) notFound();

  const song = p.anthem_url ? {
    anthem_url: p.anthem_url,
    anthem_title: p.anthem_title,
    anthem_art: p.anthem_art,
    anthem_preview: p.anthem_preview,
  } : null;

  const joined = new Date(p.joined_at).toLocaleDateString('en-US',
    { month: 'long', year: 'numeric' });

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">@{p.handle}</span>
      </div>
      <div className="bar">{p.is_mine ? 'This is how others see you' : 'Somebody’s page'}</div>

      <div className="pad">

        <div className="pcard">
          <div className="pav" aria-hidden="true">{p.display_avatar || '🌱'}</div>
          <div className="pwho">
            <span className="pname">{p.display_name}</span>
            <span className="phandle">@{p.handle}</span>
          </div>
        </div>

        {/* The count. A number, never a date — see 0008. */}
        {p.day_count !== null && p.day_count !== undefined && (
          <div className="count small">
            <div className="cn">{p.day_count.toLocaleString()}</div>
            <div className="cl">{p.day_count === 1 ? 'day' : 'days'}</div>
          </div>
        )}

        {song ? (
          <>
            <h2 className="sec">Their song</h2>
            <SongPlayer
              song={song}
              whose={p.is_mine ? 'your song' : p.display_name + '’s song'}
              big
            />
          </>
        ) : (
          <>
            <h2 className="sec">{p.is_mine ? 'Your song' : 'Their song'}</h2>
            <p className="hint">
              {p.is_mine
                ? 'You haven’t picked one yet.'
                : 'Nothing picked yet.'}
            </p>
          </>
        )}

        <p className="hint">Here since {joined}.</p>

        {p.is_mine && (
          <Link href="/me" className="btn">Edit your page</Link>
        )}
      </div>
    </>
  );
}
