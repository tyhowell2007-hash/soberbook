'use client';

import { useState } from 'react';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   FOLLOW / FOLLOWING.

   ⚠️ NOT OPTIMISTIC. The button waits for the database before it changes.

   Everywhere else in a social app, showing the new state instantly and
   reconciling later is correct — it feels fast and the worst case is a
   like that didn't land. Here the worst case is different: a follow can
   be refused because one of you blocked the other, and a button that
   flips to "Following" and quietly fails would tell somebody they're
   connected to a person who has specifically kept them out.

   Same call as the block button on Aug 6, for the same reason: a state
   that only LOOKS like it worked is dangerous in this app in a way it
   isn't in most.
   ===================================================================== */

export default function FollowButton({ handle, initialFollowing, initialCount }) {
  const supabase = browserClient();
  const [following, setFollowing] = useState(!!initialFollowing);
  const [count, setCount] = useState(initialCount || 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function toggle() {
    setBusy(true); setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');

      /* Look the target up through public_profiles, not profiles. The
         view already hides suspended, deleted and blocked people — so a
         person you can't see is a person you can't follow, without this
         file needing to know any of those rules. */
      const { data: target } = await supabase
        .from('public_profiles').select('handle')
        .eq('handle_key', handle.toLowerCase()).maybeSingle();
      if (!target) throw new Error('That page is gone.');

      const { data: row } = await supabase
        .from('profiles').select('id').eq('handle', target.handle).maybeSingle();
      if (!row) throw new Error('That page is gone.');

      if (following) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', user.id).eq('followee_id', row.id);
        if (error) throw error;
        setFollowing(false); setCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase.from('follows')
          .insert({ follower_id: user.id, followee_id: row.id });
        /* The trigger raises a check_violation for a block. Say something
           true and unrevealing — not "they blocked you", which would
           confirm both that the account exists and that they acted. */
        if (error) throw new Error("That didn't work.");
        setFollowing(true); setCount((c) => c + 1);
      }
    } catch (e) {
      setErr(e.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button"
              className={'btn follow' + (following ? ' on' : '')}
              disabled={busy} onClick={toggle}
              aria-pressed={following}>
        {busy ? '…' : following ? 'Following' : 'Follow'}
      </button>
      {err && <p className="phserr" role="alert">{err}</p>}
    </>
  );
}
