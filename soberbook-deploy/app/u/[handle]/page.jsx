import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import SongPlayer from '../../components/SongPlayer';
import Milestones from '../../components/Milestones';
import MessageButton from './MessageButton';
import { sinceFromCount } from '../../../lib/milestones';
import { signPhotoPaths } from '../../../lib/sign-photos';

export const dynamic = 'force-dynamic';

/* Somebody else's page.

   This is the first screen in Sober Book where one member reads another
   member's profile, so everything it knows comes from ONE view —
   public_profiles — and that view decides what a stranger may see. There
   is no second query here quietly topping up the data, and there should
   never be one.

   WHAT THIS PAGE CANNOT DO, BY CONSTRUCTION:
     • It has no profile id, so it cannot join this person to anything.
     • It has no privacy_mode, so it cannot tell you who is anonymous.
     • Anonymous profiles carry no prose at all — bio, town, programs
       and interests all come back null. See 0011.

   ⚠️ THIS LIST USED TO CLAIM A FOURTH THING — "it has no sober date,
   only a count" — AND THAT WAS NEVER TRUE. day_count is
   `current_date - sober_since`, so the count and the date are the same
   fact wearing different clothes; sinceFromCount() converts one to the
   other in four lines. Removed rather than reworded, because a false
   reassurance about privacy is worse than saying nothing: the next
   person builds on it. The three above are real.

   The privacy_mode one is worth sitting with. If this page could say
   "this member posts anonymously", then anyone could check a handle and
   learn which posts on the Wall to go looking through. So it doesn't
   know, and the name it shows is produced by the same expression the
   Wall uses. */
export default async function ProfilePage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const handle = decodeURIComponent(params.handle || '');

  /* Match on the lowercased copy the view provides.
     NOT .ilike() — a handle may contain an underscore, and an underscore
     is a wildcard in LIKE patterns, so `ty_howell` would also match
     `tyXhowell`. Two plain strings, compared. See 0008. */
  /* The VISITOR's own preference — read from their row, not from the
     profile they're looking at. public_profiles deliberately does not
     carry it: what somebody has their autoplay set to is nobody's
     business but theirs. */
  const { data: mine } = await supabase
    .from('profiles').select('autoplay_songs').eq('id', user.id).maybeSingle();

  const { data: p } = await supabase
    .from(assertReadable('public_profiles'))
    .select('handle, display_name, display_avatar, display_avatar_photo, day_count, ' +
            'anthem_url, anthem_title, anthem_art, anthem_preview, anthem_youtube, ' +
            'is_mine, joined_at, total_days, ' +
            'bio, location, programs, interests, sponsor_open')
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
    anthem_youtube: p.anthem_youtube,
  } : null;

  const joined = new Date(p.joined_at).toLocaleDateString('en-US',
    { month: 'long', year: 'numeric' });

  /* ⚠️ Only ever the ONE path this view handed back. public_profiles nulls
     display_avatar_photo for an anonymous profile and for anyone who
     hasn't chosen the photo option, so if there's nothing here there is
     nothing to sign — the decision was made in the database and this line
     just does as it's told. */
  /* ---- what they've put up ----
     ⚠️ FILTERED BY `author_handle`, AND THAT IS THE SAFETY MECHANISM.

     feed_posts sets author_handle to NULL on an anonymous post. So
     matching on the handle cannot return one — not because a check
     remembered to exclude them, but because there is nothing there to
     match. An anonymous post has no handle to be filed under.

     ⚠️ Do NOT "improve" this into `.eq('author_id', …).neq('is_anonymous',
     true)`. That version works right up until somebody reorders the
     conditions, and it also needs author_id, which the view withholds for
     exactly this reason. The null IS the rule. */
  const { data: theirPosts } = await supabase
    .from(assertReadable('feed_posts'))
    .select('id, body, photo_url, video_url, created_at, like_count, comment_count')
    .eq('author_handle', p.handle)
    .order('created_at', { ascending: false })
    .limit(30);

  const photos = await signPhotoPaths(supabase, [
    ...(p.display_avatar_photo ? [p.display_avatar_photo] : []),
    ...(theirPosts || []).flatMap((x) => [x.photo_url, x.video_url]),
  ]);
  const facePhoto = photos[p.display_avatar_photo] || null;

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
          {facePhoto
            ? <img className="pav pav-photo" src={facePhoto} alt="" aria-hidden="true" />
            : <div className="pav" aria-hidden="true">{p.display_avatar || '🌱'}</div>}
          <div className="pwho">
            <span className="pname">{p.display_name}</span>
            <span className="phandle">@{p.handle}</span>
          </div>
        </div>

        {/* The count, now with somewhere to be going.
            `sinceFromCount` rebuilds the date the chips need — and see
            the note on that function: the count and the date were
            always the same fact, so nothing new is being handed out
            here that the number didn't already give away. */}
        <Milestones
          since={sinceFromCount(p.day_count)}
          days={p.day_count}
          sub={p.day_count === 1 ? 'day' : 'days'}
          small
        />

        {p.bio && <p className="bio">{p.bio}</p>}

        {(p.sponsor_open || p.programs || p.location || p.interests) && (
          <div className="deets">
            {p.sponsor_open && (
              <div className="deet sponsor">
                <span className="di" aria-hidden="true">🛟</span>
                <span>Available to sponsor</span>
              </div>
            )}
            {p.programs && (
              <div className="deet">
                <span className="di" aria-hidden="true">🧭</span>
                <span>{p.programs}</span>
              </div>
            )}
            {p.location && (
              <div className="deet">
                <span className="di" aria-hidden="true">📍</span>
                <span>{p.location}</span>
              </div>
            )}
            {p.interests && (
              <div className="deet">
                <span className="di" aria-hidden="true">🎣</span>
                <span>{p.interests}</span>
              </div>
            )}
          </div>
        )}

        {/* The lifetime total, and ONLY if they chose to show it.
            The view hands back null both when it's switched off and when
            there's nothing to show, so this page cannot tell the two
            apart — which is the entire point. See 0010. */}
        {p.total_days ? (
          <div className="total">
            <span className="tn">{p.total_days.toLocaleString()}</span>
            <span className="tl">days total, all of it</span>
          </div>
        ) : null}

        {song ? (
          <>
            <h2 className="sec">Their song</h2>
            <SongPlayer
              song={song}
              whose={p.is_mine ? 'your song' : p.display_name + '’s song'}
              autoplay={!!mine?.autoplay_songs}
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

        {/* ---- their posts ---- */}
        <h2 className="sec">{p.is_mine ? 'What you’ve put up' : 'What they’ve put up'}</h2>
        {!theirPosts || theirPosts.length === 0 ? (
          <p className="hint">
            {p.is_mine
              ? 'Nothing yet — anything you post openly shows up here.'
              : 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="mine">
            {theirPosts.map((t) => (
              <li key={t.id}>
                {t.body ? <p className="mb">{t.body}</p> : null}
                {t.photo_url && photos[t.photo_url] && (
                  <div className="mphoto">
                    <img src={photos[t.photo_url]} alt="" loading="lazy" />
                  </div>
                )}
                {t.video_url && photos[t.video_url] && (
                  <div className="mphoto">
                    <video src={photos[t.video_url]} controls playsInline
                           preload="metadata" />
                  </div>
                )}
                <div className="mm">
                  {new Date(t.created_at).toLocaleDateString('en-US',
                    { month: 'short', day: 'numeric' })}
                  {t.like_count > 0 ? ` · ${t.like_count} ♥` : ''}
                  {t.comment_count > 0
                    ? ` · ${t.comment_count} ${t.comment_count === 1 ? 'reply' : 'replies'}`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="hint">Here since {joined}.</p>

        {p.is_mine
          ? <Link href="/me" className="btn">Edit your page</Link>
          : <MessageButton handle={p.handle} />}
      </div>
    </>
  );
}
