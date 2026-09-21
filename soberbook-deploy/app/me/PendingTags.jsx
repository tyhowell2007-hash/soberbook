'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* A pending tag is a privacy decision, not a notification. It keeps its own
   small piece of state so approving or declining removes it only after the
   database agrees; an optimistic removal could tell a member their handle is
   hidden or visible when the opposite is true. */
export default function PendingTags({ initialTags = [] }) {
  const [tags, setTags] = useState(initialTags);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const supabase = browserClient();

  async function decide(postId, action) {
    setBusy(postId);
    setError('');
    const { error: writeError } = await supabase.rpc(action, { p_post: postId });
    setBusy('');
    if (writeError) {
      setError('That did not save. Please try again.');
      return;
    }
    setTags((current) => current.filter((tag) => tag.post_id !== postId));
  }

  /* Silence is intentional when there is nothing waiting. An empty-state
     message would still turn the profile settings into a notifications page. */
  if (tags.length === 0) return null;

  return (
    <div className="pendtags">
      <h2 className="sec">Somebody tagged you</h2>
      <ul>
        {tags.map((tag) => (
          <li key={tag.post_id}>
            <p className="pt-who">
              <b>{tag.tagged_by}</b> put your handle on a post
            </p>
            {tag.preview ? <p className="pt-prev">“{tag.preview}”</p> : null}
            <p className="pt-note">
              Your handle isn’t on it yet. Nobody sees this until you say so.
            </p>
            <div className="pt-btns">
              <button className="pt-yes" type="button" disabled={!!busy}
                      onClick={() => decide(tag.post_id, 'approve_my_tag')}>
                Let it show
              </button>
              {/* Declining uses the same removal operation as taking an
                  approved tag off later. The person who tagged them is not
                  notified, so saying no cannot start an unwanted exchange. */}
              <button className="pt-no" type="button" disabled={!!busy}
                      onClick={() => decide(tag.post_id, 'remove_my_tag')}>
                No thanks
              </button>
            </div>
            <p className="pt-fine">“No thanks” doesn’t tell them.</p>
          </li>
        ))}
      </ul>
      {error && <div className="err" role="alert">{error}</div>}
    </div>
  );
}
