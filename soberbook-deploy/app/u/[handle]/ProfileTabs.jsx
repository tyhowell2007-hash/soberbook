'use client';

import { useId, useState } from 'react';
import './profile-tabs.css';

/* 22 Sept — Ty picked option 2 of three prototypes.

   Will's posts-only profile (PR #8) stays the default: the page opens on
   Posts, exactly as it did yesterday. "About" brings back what that change
   hid — bio, song, sponsor, programs, town, interests, lifetime days —
   without making the page read like a dashboard again.

   Both panes arrive already rendered by the server page. This component
   only decides which one is visible, so nothing about WHAT a visitor may
   see is decided here; that stays in public_profiles and feed_posts.

   ⚠️ `about` is null when the member filled in nothing at all. Then there
   are no tabs — a tab that opens onto an empty card is a "nothing here"
   line by another name, and blank fields must leave no trace.

   🖼 23 Oct (0190) — a third pane, Photos, on the same terms. `photos` is
   null when the member has put nothing up, and the tab is not drawn.
   ⚠️ The two optional panes are INDEPENDENT: somebody with photos and no
   bio gets Posts | Photos, somebody with a bio and no photos gets the
   two tabs they had yesterday, and somebody with neither still gets no
   tab strip at all and a page byte-for-byte what it was. Writing this as
   `if (!about) return posts` with a third tab bolted on underneath would
   have hidden the album of every member who never filled in a bio. */
/* 🎬 31 Oct (0197) — Videos, on the same terms as Photos: null when the
   member has no videos, and then the tab is not drawn. */
export default function ProfileTabs({ posts, about, photos, videos = null }) {
  const [tab, setTab] = useState('posts');
  const id = useId();

  if (!about && !photos && !videos) return posts;

  const Tab = ({ k, label }) => (
    <button type="button" role="tab" id={`${id}-${k}-t`}
            aria-selected={tab === k} aria-controls={`${id}-${k}`}
            className={'ptab' + (tab === k ? ' on' : '')}
            onClick={() => setTab(k)}>
      {label}
    </button>
  );

  return (
    <div className="ptabs-wrap">
      <div className="ptabs" role="tablist" aria-label="Profile">
        <Tab k="posts" label="Posts" />
        {about  && <Tab k="about"  label="About" />}
        {photos && <Tab k="photos" label="Photos" />}
        {videos && <Tab k="videos" label="Videos" />}
      </div>
      <div role="tabpanel" id={`${id}-posts`} aria-labelledby={`${id}-posts-t`}
           hidden={tab !== 'posts'}>
        {posts}
      </div>
      {about && (
        <div role="tabpanel" id={`${id}-about`} aria-labelledby={`${id}-about-t`}
             hidden={tab !== 'about'}>
          {about}
        </div>
      )}
      {photos && (
        <div role="tabpanel" id={`${id}-photos`} aria-labelledby={`${id}-photos-t`}
             hidden={tab !== 'photos'}>
          {photos}
        </div>
      )}
      {videos && (
        <div role="tabpanel" id={`${id}-videos`} aria-labelledby={`${id}-videos-t`}
             hidden={tab !== 'videos'}>
          {videos}
        </div>
      )}
    </div>
  );
}
