import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import SongPlayer from '../../components/SongPlayer';
import Milestones from '../../components/Milestones';
import MessageButton from './MessageButton';
import RowMenu from '../../friends/RowMenu';
import FriendButton from './FriendButton';
import { sinceFromCount } from '../../../lib/milestones';
import { signPhotoPaths } from '../../../lib/sign-photos';
/* 🔴 A CLIENT COMPONENT IMPORTED BY A SERVER PAGE, and that is allowed —
   it is the DEFAULT export. What is not allowed is importing a NAMED
   export from a client module here; Next turns those into client
   references and calling one on the server throws (2 Sept, /wall down
   fifteen minutes). Shot has exactly one export for that reason. */
import Shot from '../../components/Shot';
/* Artist profiles, 19 Sept. Both are client components imported by their
   DEFAULT export — the only kind a server page may import. */
import ArtistCheck from '../../components/ArtistCheck';
import { coverCss, accentHex, normaliseSections } from '../../../lib/look';
import ArtistBar from '../../components/ArtistBar';

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
            'anthem_spotify, ' +
            'is_mine, joined_at, total_days, ' +
            'bio, location, programs, interests, sponsor_open, ' +
            'sponsor_has, sponsor_looking, friends, friend_state, ' +
            /* 🔴 0182 — THE LOOK. THIS SELECT NAMES ITS COLUMNS ONE BY ONE,
               so a column added to the view is invisible here until it is
               added to this string too. That is what shipped broken on 20
               Sept: cover, accent and sections were in the table, in the
               view, saved correctly by the picker and rendered correctly
               by the markup below — and every page still came out green
               with no cover, because they were never asked for. Nothing
               errored. An unasked-for column arrives as undefined, and
               `coverCss(undefined)` and `accentHex(undefined)` both fall
               back to the default by design, so the page looked like a
               member who had simply never picked anything.
               ⚠️ Add a column to public_profiles, add it here. */
            'cover, accent, sections')
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
    /* ⚠️ Added to BOTH lists. The select above decides what the view
       hands over; this object decides what the player is given. Adding
       it to one and not the other is a song that plays for its owner and
       nobody else. */
    anthem_spotify: p.anthem_spotify,
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
    /* 🔴 support_count/strength_count, NOT like_count. The ♥ this page
       used to print came from `likes`, which was RETIRED on 7 Sept when
       Support took the heart. Leaving it here meant the wall said
       "❤️ Support 3" and the profile said "· 3 ♥" for the same post, from
       two different tables — the app disagreeing with itself about the
       same fact. Found because Ty looked at his own profile. */
    .select('id, body, photo_url, photo_urls, video_url, created_at, support_count, strength_count, comment_count')
    .eq('author_handle', p.handle)
    .order('created_at', { ascending: false })
    .limit(30);

  const photos = await signPhotoPaths(supabase, [
    ...(p.display_avatar_photo ? [p.display_avatar_photo] : []),
    /* ⚠️ Spread photo_urls in (0065) — otherwise photos 2..10 are never
       signed and render as broken frames on somebody else's profile. */
    ...(theirPosts || []).flatMap((x) => [
      ...(Array.isArray(x.photo_urls) ? x.photo_urls : []), x.photo_url, x.video_url]),
  ]);
  const facePhoto = photos[p.display_avatar_photo] || null;

  /* ---- verified artist? (19 Sept) ----
     artist_page() returns null for everyone who isn't an approved artist
     the viewer may see, so on almost every profile this is null and the
     page below renders exactly as it always has. */
  const { data: artist } = await supabase.rpc('artist_page', { p_handle: p.handle });

  /* ---- 0182: the look the member chose ----
     ⚠️ Imported from lib/look.js, NOT from the picker — LookPicker is a
     'use client' module and a named import from one of those into a
     server page is the 2 Sept wall outage. */
  const coverBg = artist ? null : coverCss(p.cover);
  const accent = accentHex(p.accent);
  const order = normaliseSections(p.sections);
  /* 0180: the same page for authors and podcasters (Dr. Labor, 19 Sept).
     A musician's page is unchanged; an author/podcaster swaps "shows" for
     "talks" and gains About, Books and The podcast. */
  const isMusician = !artist || !Array.isArray(artist.kinds) || artist.kinds.includes('musician');
  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg cvname">@{p.handle}</span>
        {/* 🔴 30 AUG — YOU COULD NOT REPORT OR BLOCK SOMEBODY FROM THEIR
            OWN PAGE. This is the surface where you decide what you think
            of a person: you tapped their name, or found them in search,
            and you are reading everything they have chosen to say about
            themselves. If that is where somebody realises they want out,
            it is where the way out has to be.

            Until tonight the answer was: leave, open Community, scroll a
            hundred-odd people, find them again. Same shape as the
            conversation ⋯ fixed earlier this evening. Twelfth "everything
            built except the way in" — `reports.target_type` has allowed
            'profile' since the table was written and the moderation queue
            already renders it.

            ⚠️ Not on your own page. Reporting yourself is nonsense, and
            RowMenu's Block would be a loaded gun pointed at your own
            account. */}
        {/* ⚠️ primaryLabel={null} — no Message here. This page already
            has a working MessageButton further down that calls
            start_thread properly. My first draft pointed the menu at
            `/chat?to=<handle>`, which is the 20 Aug bug exactly: nothing
            reads that parameter, so it loads the right page and does
            nothing. Report and Block are the whole job here. */}
        {!p.is_mine && (
          <RowMenu handle={p.handle} name={p.display_name || p.handle}
                   primaryLabel={null} />
        )}
      </div>
      <div className="bar">{p.is_mine ? 'This is how others see you' : 'Somebody’s page'}</div>

      <div className={artist ? 'pad art-page' : 'pad'} style={{ '--acc': accent }}>

        {artist ? (
          /* ===== THE ARTIST PAGE — the layout Ty approved in the prototype ===== */
          <>
            <section className="art-hero" aria-label="Artist">
              <div className="art-cover" aria-hidden="true">
                <svg viewBox="0 0 400 56" preserveAspectRatio="none">
                  {isMusician
                    ? <path d="M0 40 Q 25 10 50 34 T 100 30 T 150 20 T 200 36 T 250 14 T 300 32 T 350 22 T 400 30 V56 H0Z" fill="#F6EBC8" />
                    /* the one long hill from the approved Dr. Labor prototype */
                    : <path d="M0 40 C40 10 80 10 120 34 S200 60 240 24 S320 0 360 30 S400 40 400 40 V56 H0Z" fill="#F4F0C8" />}
                </svg>
              </div>
              <div className="art-heroin">
                <div className="art-av" aria-hidden="true">
                  {facePhoto
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={facePhoto} alt="" />
                    : (p.display_avatar || String(artist.name || p.handle).slice(0, 1).toUpperCase())}
                </div>
                <h2 className="art-title">
                  {artist.name}
                  <svg className="gchk" viewBox="0 0 24 24" role="img" aria-label="Verified">
                    <title>Verified</title>
                    <circle cx="12" cy="12" r="11" /><path d="M7 12.5l3.2 3.2L17.2 8.6" />
                  </svg>
                </h2>
                <p className="art-hh">@{p.handle}{p.location ? ` · ${p.location}` : ''}</p>
                {(artist.role_line || artist.genre) && <p className="art-hh">{artist.role_line || artist.genre}</p>}
                <ArtistBar handle={p.handle} followers={artist.followers} following={artist.following}
                           isMine={!!artist.is_mine} days={p.day_count} sinceYear={artist.since_year}>
                  {!p.is_mine && <MessageButton handle={p.handle} />}
                </ArtistBar>
              </div>
            </section>

            {song && (
              <div className="art-sect">
                <p className="art-sub">Anthem</p>
                <SongPlayer song={song} whose={artist.name + '’s song'}
                            autoplay={!!mine?.autoplay_songs} big />
              </div>
            )}

            {artist.about && (
              <div className="art-sect">
                <p className="art-sub">About</p>
                <p className="art-about">{artist.about}</p>
              </div>
            )}

            {Array.isArray(artist.books) && artist.books.length > 0 && (
              <div className="art-sect">
                <p className="art-sub">Books</p>
                <ul className="art-books">
                  {artist.books.map((b, i) => (
                    <li key={i} className="art-book">
                      <span className="art-spine" aria-hidden="true" data-n={i % 3}>
                        {b.tag || String(b.title).replace(/^the\s+/i, '').split(/[\s:]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </span>
                      <span className="art-bk">
                        <b>{b.title}</b>
                        {b.blurb && <small>{b.blurb}</small>}
                      </span>
                      {b.url && <a className="art-get" href={b.url} target="_blank" rel="noreferrer noopener">Get it ↗</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {artist.podcast && Array.isArray(artist.podcast.episodes) && artist.podcast.episodes.length > 0 && (
              <div className="art-sect">
                <p className="art-sub">The podcast · {String(artist.podcast.label).replace(/\s*\(podcast\)\s*$/i, '')}</p>
                <ul className="art-books">
                  {artist.podcast.episodes.map((e, i) => (
                    <li key={i} className="art-book">
                      <span className="art-play" aria-hidden="true">▶</span>
                      <span className="art-bk">
                        {e.url
                          ? <a href={e.url} target="_blank" rel="noreferrer noopener"><b>{e.title}</b></a>
                          : <b>{e.title}</b>}
                        {e.at && <small>{MON[new Date(e.at).getMonth()].charAt(0) + MON[new Date(e.at).getMonth()].slice(1).toLowerCase()} {new Date(e.at).getDate()}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(artist.links) && artist.links.length > 0 && (
              <div className="art-sect">
                <p className="art-sub">Listen &amp; follow</p>
                <div className="art-links">
                  {artist.links.map((l) => (
                    /* noreferrer: the artist's site never learns the visitor
                       came from a recovery app. */
                    <a key={l.url} className="art-link" href={l.url}
                       target="_blank" rel="noreferrer noopener">{l.label} ↗</a>
                  ))}
                </div>
              </div>
            )}

            <div className="art-sect">
              <p className="art-sub">{isMusician ? 'Upcoming shows' : 'Upcoming talks'}</p>
              {Array.isArray(artist.shows) && artist.shows.length > 0 ? (
                <ul className="art-shows">
                  {artist.shows.map((sh, i) => {
                    const d = new Date(sh.date + 'T12:00:00');
                    return (
                      <li key={i} className="art-show">
                        <span className="art-date">{d.getDate()}<small>{MON[d.getMonth()]}</small></span>
                        <span>
                          <span className="art-venue">
                            {sh.url
                              ? <a href={sh.url} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit' }}>{sh.venue} ↗</a>
                              : sh.venue}
                          </span>
                          {sh.city && <span className="art-city"><br />{sh.city}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="art-none">{isMusician ? 'No shows listed right now.' : 'No talks listed right now.'}</p>}
            </div>
          </>
        ) : (
        <>
        {/* ===== THE HERO — cover, face, name and the count, ONE card =====
            Ty, 20 Sept, holding up the old acid counter: "make it look
            like that, but blend it into the profile to make it look
            like it's not just bolted on."

            Nothing below was rewritten to do that. `.pcard` and
            `Milestones` emit exactly the markup they always have — they
            simply lose their own edges inside `.uhero`, which carries
            the single border. That matters: the count is the most
            looked-at number in the app and the one people screenshot,
            and this was a layout change, not a rewrite of it.

            🔴 THE COUNT IS NOT OPTIONAL AND NOT MOVABLE. It is not in
            BLOCKS (lib/look.js) and it never should be — "the sobriety
            counter still needs to be up on top of the header somewhere"
            (Ty, same afternoon). A member who wants their number private
            already has the control for that in /me; hiding it is a
            privacy choice, not a decoration choice, and the two must not
            end up in the same picker. */}
        <div className="uhero">
          <div className={'ucover' + (coverBg ? '' : ' flat')}
               style={coverBg ? { backgroundImage: coverBg } : undefined}
               aria-hidden="true" />
          <div className="pcard">
            {facePhoto
              ? <img className="pav pav-photo" src={facePhoto} alt="" aria-hidden="true" />
              : <div className="pav" aria-hidden="true">{p.display_avatar || '\u{1F331}'}</div>}
            <div className="pwho">
              <span className="pname">{p.display_name}<ArtistCheck handle={p.handle} /></span>
              <span className="phandle">@{p.handle}</span>
            </div>
          </div>

          {/* The count, now with somewhere to be going.
              `sinceFromCount` rebuilds the date the chips need — and see
              the note on that function: the count and the date were
              always the same fact, so nothing new is being handed out
              here that the number didn't already give away. */}
          <div className="ucount">
            <Milestones
              since={sinceFromCount(p.day_count)}
              days={p.day_count}
              sub={p.day_count === 1 ? 'day' : 'days'}
              small
            />
          </div>
        </div>
        </>
        )}
        {p.bio && <p className="bio">{p.bio}</p>}

        {(p.sponsor_open || p.sponsor_has || p.sponsor_looking
          || p.programs || p.location || p.interests) && (
          <div className="deets">
            {p.sponsor_open && (
              <div className="deet sponsor">
                <span className="di" aria-hidden="true">🛟</span>
                <span>Available to sponsor</span>
              </div>
            )}
            {p.sponsor_has && (
              <div className="deet">
                <span className="di" aria-hidden="true">🤝</span>
                <span>Has a sponsor</span>
              </div>
            )}
            {/* 🔴 NO `!p.sponsor_has &&` GUARD HERE, and no "looking for
                a sponsor" placeholder anywhere for people who haven't
                ticked it. The absence has to stay silent.

                `sponsor_looking` is already false for a viewer under a
                year — the gate is in public_profiles (0031) and asks
                about the VIEWER, not the person whose page this is. So
                a newer member cannot tell the difference between
                "didn't tick it" and "ticked it and I'm not allowed to
                know". That indistinguishability IS the protection: a
                flag you can detect the absence of is a flag you can
                enumerate. */}
            {p.sponsor_looking && (
              <div className="deet sponsor">
                <span className="di" aria-hidden="true">🔎</span>
                <span>Looking for a sponsor</span>
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

        {/* ===== THE BLOCKS, IN THE ORDER THIS MEMBER CHOSE (0182) =====
            `order` comes from normaliseSections(), so a block added to
            BLOCKS after somebody saved their arrangement arrives ON at
            the end rather than silently vanishing, and a key we no
            longer ship is dropped rather than rendering nothing.

            ⚠️ AN ARTIST PAGE DOES NOT READ `order`. It keeps the layout
            Ty approved in the prototype — but its posts still have to
            render, which is why `artist` short-circuits to a posts-only
            list here instead of falling through to nothing. Deleting
            that ternary takes the posts off every verified page. */}
        {(artist ? [{ k: 'posts', on: true }] : order.filter((r) => r.on)).map((r) => (
          <div className="ublk" key={r.k}>
            {r.k === 'total' ? (
              <>
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
              </>
            ) : r.k === 'song' ? (
              <>
            {artist ? null : song ? (
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
              </>
            ) : (
              <>
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
                    {/* ⚠️ 0065: several photos become a grid, one stays exactly
                        as it was. Same rule as the wall — see app/photos.css. */}
                    {(() => {
                      const shots = (Array.isArray(t.photo_urls) && t.photo_urls.length
                        ? t.photo_urls : []).filter((s) => photos[s]);
                      if (shots.length < 2) return null;
                      return (
                        <div className="pgrid" data-n={Math.min(shots.length, 4)}>
                          {shots.map((s, i) => (
                            <Shot key={s} path={s} src={photos[s]}
                                  zoom={{ items: shots.map((x) => ({ path: x, url: photos[x] })), i }}
                                  alt={`Photo ${i + 1} of ${shots.length}`} />
                          ))}
                        </div>
                      );
                    })()}
                    {(!Array.isArray(t.photo_urls) || t.photo_urls.length < 2)
                      && t.photo_url && photos[t.photo_url] && (
                      <div className="mphoto">
                        <Shot path={t.photo_url} src={photos[t.photo_url]}
                              zoom={{ items: [{ path: t.photo_url, url: photos[t.photo_url] }], i: 0 }}
                              alt="" />
                      </div>
                    )}
                    {t.video_url && photos[t.video_url] && (
                      <div className="mphoto">
                        <video src={photos[t.video_url]} controls playsInline
                               preload="none" />
                      </div>
                    )}
                    <div className="mm">
                      {new Date(t.created_at).toLocaleDateString('en-US',
                        { month: 'short', day: 'numeric' })}
                      {/* ⚠️ Counts, not buttons. This is a compact list of a
                          member's posts, not a feed of cards — a tappable
                          control in a one-line summary row is a mis-tap
                          waiting to happen. You react on the post itself.
                          🔴 Never a zero, same as everywhere else. */}
                      {t.support_count > 0 ? ` · ❤️ ${t.support_count}` : ''}
                      {t.strength_count > 0 ? ` · 🤝 ${t.strength_count}` : ''}
                      {t.comment_count > 0
                        ? ` · ${t.comment_count} ${t.comment_count === 1 ? 'reply' : 'replies'}`
                        : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
              </>
            )}
          </div>
        ))}

        <p className="hint">Here since {joined}.</p>

        {/* One number now, not two. Ty chose to keep it public on Aug 19,
            knowing the argument against it.

            ⚠️ IT IS NO LONGER A LINK. Following had public LISTS as well
            as counts; friendship is mutual, so a public friend list is a
            map of who in recovery knows whom — being on somebody's list
            outs you by association, whether or not you wanted it. The
            count says "this person is real and connected", which is what
            it was for. The list said more than that. */}
        <div className="fstats">
          <span className="fstat">
            <b>{p.friends}</b>
            <span>{p.friends === 1 ? 'friend' : 'friends'}</span>
          </span>
        </div>

        {p.is_mine
          ? <Link href="/me" className="btn">Edit your page</Link>
          : (
            <div className="pacts">
              <FriendButton handle={p.handle} initialState={p.friend_state} />
              {!artist && <MessageButton handle={p.handle} />}
            </div>
          )}
      </div>
    </>
  );
}
