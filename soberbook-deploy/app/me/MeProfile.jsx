import Link from 'next/link';
import Milestones from '../components/Milestones';
import Shot from '../components/Shot';
import { dayCount, startsInDays } from '../../lib/milestones';
import { coverCss, accentHex } from '../../lib/look';
import ProfileTabs from '../u/[handle]/ProfileTabs';
/* 26 Sept — both of these were built, styled and then never imported.
   me/layout.jsx has been loading pledge.css and the .pp* grid in
   me-cream.css the whole time; only these two lines were missing. */
import PledgeRecord from './PledgeRecord';
import People from './People';

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

/* The default /me screen is deliberately a profile, not a dashboard.

   Settings still live in Me.jsx, reached through the edit link below. Keeping
   the two routes separate prevents notifications, friends and phone controls
   from slowly turning this page back into a second home feed.

   ⚠️ `posts` comes from feed_posts filtered by `is_mine` on the server. That
   is why this screen can safely include the member's own anonymous posts
   without receiving an author id or teaching any public profile who wrote
   them. Do not replace that server-side filter with author_id. */
export default function MeProfile({ profile, posts, avatarUrl, postPhotoUrls = {},
                                    about = null, friends = [] }) {
  const anonymous = profile.privacy_mode === 'anonymous';
  const since = profile.sober_since || '';
  const days = dayCount(since);
  const startsIn = startsInDays(since);
  const cover = coverCss(profile.cover);
  const facePhoto = !anonymous && profile.avatar_kind === 'photo' ? avatarUrl : null;
  const face = anonymous ? '🤫' : (profile.avatar || '🌱');
  const name = anonymous ? profile.handle : (profile.display_name || profile.handle);

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">you</span>
      </div>
      <div className="bar">Your profile · your posts</div>

      <div className="pad" style={{ '--acc': accentHex(profile.accent) }}>
        <div className="uhero">
          <div className={'ucover' + (cover ? '' : ' flat')}
               style={cover ? { backgroundImage: cover } : undefined}
               aria-hidden="true" />
          <div className="pcard">
            {facePhoto
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img className="pav pav-photo" src={facePhoto} alt="" aria-hidden="true" />
              : <div className="pav" aria-hidden="true">{face}</div>}
            <div className="pwho">
              <span className="pname">{name}</span>
              <span className="phandle">@{profile.handle}</span>
            </div>
          </div>

          {/* A future recovery date is private context, not a public-style
              countdown. The settings screen explains it; this profile simply
              waits until there is a real count to show. */}
          {since && startsIn === null && (
            <div className="ucount">
              <Milestones since={since} days={days}
                          sub={days === 1 ? 'day' : 'days'} />
            </div>
          )}
        </div>

        <div className="editbar">
          <Link href="/me?edit=1" className="btn">Edit your profile</Link>
        </div>

        {/* ⚠️ THE PLEDGE SITS ABOVE THE TABS, NOT INSIDE THEM. Ty put it
            "underneath or just right above their song", and the song now
            lives in the About pane — so above the tab strip is as close
            to that as this layout gets, and it stays visible without a
            tap. It renders nothing at all for anybody who has never
            pledged, so most pages are unchanged. */}
        <PledgeRecord />

        {/* ⚠️ YOUR PEOPLE, AND ONLY ON YOUR OWN PAGE. /u/[handle] keeps
            the count and no names — a public friend list outs people by
            association. This grid shows the names because the only
            person who can open this page is the person it is about. */}
        <People friends={friends} />

        <ProfileTabs about={about} posts={(
          <div className="ublk">
          <h2 className="sec">What you&apos;ve put up</h2>
          {posts.length === 0 ? (
            <p className="hint">Nothing yet. The wall is through the arrow up top.</p>
          ) : (
            <ul className="mine">
              {posts.map((post) => {
                const photoPaths = (Array.isArray(post.photo_urls) && post.photo_urls.length
                  ? post.photo_urls
                  : post.photo_url ? [post.photo_url] : [])
                  .filter((path) => postPhotoUrls[path]);

                return (
                  <li key={post.id} className={post.is_anonymous ? 'screened' : ''}>
                    {post.body ? <p className="mb">{post.body}</p> : null}
                    {photoPaths.length > 1 && (
                      <div className="pgrid" data-n={Math.min(photoPaths.length, 4)}>
                        {photoPaths.map((path, i) => (
                          <Shot key={path} path={path} src={postPhotoUrls[path]}
                                zoom={{ items: photoPaths.map((item) => ({
                                  path: item, url: postPhotoUrls[item],
                                })), i }}
                                alt={`Photo ${i + 1} of ${photoPaths.length}`} />
                        ))}
                      </div>
                    )}
                    {photoPaths.length === 1 && (
                      <div className="mphoto">
                        <Shot path={photoPaths[0]} src={postPhotoUrls[photoPaths[0]]}
                              zoom={{ items: [{
                                path: photoPaths[0], url: postPhotoUrls[photoPaths[0]],
                              }], i: 0 }}
                              alt="" />
                      </div>
                    )}
                    {post.video_url && postPhotoUrls[post.video_url] && (
                      <div className="mphoto">
                        <video src={postPhotoUrls[post.video_url]} controls playsInline
                               preload="none" />
                      </div>
                    )}
                    <div className="mm">
                      {ago(post.created_at)}
                      {post.is_anonymous ? ' · posted anonymously' : ''}
                      {post.support_count > 0 ? ` · ❤️ ${post.support_count}` : ''}
                      {post.strength_count > 0 ? ` · 🤝 ${post.strength_count}` : ''}
                      {post.comment_count > 0
                        ? ` · ${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'}`
                        : ' · no replies yet'}
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
