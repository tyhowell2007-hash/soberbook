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
   line by another name, and blank fields must leave no trace. */
export default function ProfileTabs({ posts, about }) {
  const [tab, setTab] = useState('posts');
  const id = useId();

  if (!about) return posts;

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
        <Tab k="about" label="About" />
      </div>
      <div role="tabpanel" id={`${id}-posts`} aria-labelledby={`${id}-posts-t`}
           hidden={tab !== 'posts'}>
        {posts}
      </div>
      <div role="tabpanel" id={`${id}-about`} aria-labelledby={`${id}-about-t`}
           hidden={tab !== 'about'}>
        {about}
      </div>
    </div>
  );
}
