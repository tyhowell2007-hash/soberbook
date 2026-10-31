import Link from 'next/link';
import Milestones from '../../components/Milestones';
import MessageButton from './MessageButton';
import RowMenu from '../../friends/RowMenu';
import FriendButton from './FriendButton';
import ArtistCheck from '../../components/ArtistCheck';
import Shot from '../../components/Shot';
import { sinceFromCount } from '../../../lib/milestones';
import ProfileTabs from './ProfileTabs';
import Gallery from '../../components/Gallery';
import VideoCards from '../../components/VideoCards';
import Coin from '../../components/Coin';
import CoinShelf from '../../components/CoinShelf';
import { coinTotal, topKinds } from '../../../lib/coins';
import TheirPeople from './TheirPeople';
import { aboutPane } from './about';

/* An ordinary member profile leads with that member's public posts (Will,
   PR #8). Since 22 Sept an "About" tab beside Posts holds what they chose
   to say about themselves — bio, song, details, lifetime days — so the page
   opens like a profile, not a dashboard, and nothing they filled in is lost.

   ⚠️ The parent page obtains `posts` by matching feed_posts.author_handle.
   Anonymous posts have a NULL author_handle in that view, so they cannot
   enter this component. Do not pass posts selected by author_id. */
export default function MemberProfile({ profile, posts, photos, gallery = [], videos = [],
                                        facePhoto,
                                        coverBackground, accent, song, autoplay }) {
  const p = profile;

  const about = aboutPane(p, song, autoplay);

  /* 🖼 0190 — the Photos pane, or nothing at all.

     ⚠️ Built from the paths the VIEW handed back, filtered down to the
     ones that actually got signed. public_profiles returns an empty
     array for anybody in anonymous mode, so an anonymous member's page
     has no Photos tab on it — not because this line checks for anonymity
     (it has no idea what that is) but because there is nothing in the
     array to draw. Same shape as the author_handle rule above: the empty
     answer IS the rule. */
  const shown = (Array.isArray(gallery) ? gallery : []).filter((x) => photos[x]);
  /* 🎬 0197 — the Videos tab. Drawn cards, nothing fetched from the video
     host; null when they have no videos, so no tab is drawn. */
  const videoPane = videos.length
    ? <VideoCards videos={videos} handle={p.handle} dayNow={p.day_count != null ? Number(p.day_count) : null} />
    : null;
  const photoPane = shown.length
    ? <Gallery paths={shown} urls={photos} mine={!!p.is_mine} />
    : null;

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg cvname">@{p.handle}</span>
        {!p.is_mine && (
          <RowMenu handle={p.handle} name={p.display_name || p.handle}
                   primaryLabel={null} />
        )}
      </div>
      <div className="bar">{p.is_mine ? 'This is how others see you' : 'Member profile'}</div>

      <div className="pad" style={{ '--acc': accent }}>
        <div className="uhero">
          <div className={'ucover' + (coverBackground ? '' : ' flat')}
               style={coverBackground ? { backgroundImage: coverBackground } : undefined}
               aria-hidden="true" />
          <div className="pcard">
            {facePhoto
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img className="pav pav-photo" src={facePhoto} alt="" aria-hidden="true" />
              : <div className="pav" aria-hidden="true">{p.display_avatar || '🌱'}</div>}
            <div className="pwho">
              <span className="pname">
                {p.display_name || p.handle}<ArtistCheck handle={p.handle} />
              </span>
              <span className="phandle">@{p.handle}</span>
            </div>
          </div>
          <div className="ucount">
            <Milestones since={sinceFromCount(p.day_count)} days={p.day_count}
                        sub={p.day_count === 1 ? 'day' : 'days'} small />
          </div>
        </div>

        {/* 🔴 THE COUNT, NEVER THE LIST. Restored 26 Sept — it was lost
            when this renderer replaced the markup in page.jsx, and Nick
            Roster noticed it gone before we did.

            Friendship is mutual, so a public friend list is a map of who
            in recovery knows whom: being on somebody's list outs you by
            association, whether or not you wanted it. The count says
            "this person is real and connected", which is what it was for.
            The list said more than that.

            ⚠️ `friends` is already on the public_profiles row the parent
            selected. Do not add a second query for it. */}
        <div className="fstats">
          <span className="fstat">
            <b>{p.friends}</b>
            <span>{p.friends === 1 ? 'friend' : 'friends'}</span>
          </span>
        </div>

        {p.is_mine ? (
          <div className="editbar">
            <Link href="/me?edit=1" className="btn">Edit your profile</Link>
          </div>
        ) : (
          <div className="pacts">
            <FriendButton handle={p.handle} initialState={p.friend_state} />
            <MessageButton handle={p.handle} />
          </div>
        )}

        {/* ⚠️ WHO THEY KNOW — friends only, 26 Sept. The guard is
            friends_of_member() in the database, not this line: it
            returns an empty set to anyone who is not this member or an
            accepted friend, and the component renders nothing at all on
            an empty set. A stranger's page is byte-for-byte what it was
            before. The count above stays public; the names never are. */}
        <TheirPeople handle={p.handle} name={p.display_name || null} />

        {/* 0195 — only appears if they switched their shelf on (or it is
            you). coin_shelf() decides; this draws nothing for null. */}
        <CoinShelf handle={p.handle} mine={!!p.is_mine} />

        <ProfileTabs about={about} photos={photoPane} videos={videoPane} posts={(
        <div className="ublk">
          <h2 className="sec">{p.is_mine ? 'What you’ve put up' : 'What they’ve put up'}</h2>
          {!posts || posts.length === 0 ? (
            <p className="hint">
              {p.is_mine
                ? 'Nothing yet — anything you post openly shows up here.'
                : 'Nothing here yet.'}
            </p>
          ) : (
            <ul className="mine">
              {posts.map((post) => {
                const photoPaths = (Array.isArray(post.photo_urls) && post.photo_urls.length
                  ? post.photo_urls
                  : post.photo_url ? [post.photo_url] : [])
                  .filter((path) => photos[path]);

                return (
                  <li key={post.id}>
                    {post.body ? <p className="mb">{post.body}</p> : null}
                    {photoPaths.length > 1 && (
                      <div className="pgrid" data-n={Math.min(photoPaths.length, 4)}>
                        {photoPaths.map((path, i) => (
                          <Shot key={path} path={path} src={photos[path]}
                                zoom={{ items: photoPaths.map((item) => ({
                                  path: item, url: photos[item],
                                })), i }}
                                alt={`Photo ${i + 1} of ${photoPaths.length}`} />
                        ))}
                      </div>
                    )}
                    {photoPaths.length === 1 && (
                      <div className="mphoto">
                        <Shot path={photoPaths[0]} src={photos[photoPaths[0]]}
                              zoom={{ items: [{
                                path: photoPaths[0], url: photos[photoPaths[0]],
                              }], i: 0 }}
                              alt="" />
                      </div>
                    )}
                    {post.video_url && photos[post.video_url] && (
                      <div className="mphoto">
                        <video src={photos[post.video_url]} controls playsInline preload="none" />
                      </div>
                    )}
                    <div className="mm">
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                      {/* 0195 — one coin count, drawn with the coin this post got most of. */}
                      {coinTotal(post) > 0 ? (<> · <span className="mmcoin"><Coin kind={topKinds(post, 1)[0]} size={15} />{coinTotal(post)}</span></>) : ''}
                      {post.comment_count > 0
                        ? ` · ${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'}`
                        : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )} />
      </div>
    </>
  );
}
