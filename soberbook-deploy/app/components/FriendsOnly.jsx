'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   0201 — what you see when start_thread() says SB002: this person is
   only taking messages from friends (a newcomer, or their own choice).
   Offers a friend request instead. Polite limits, no drama.

   ⚠️ Same refusal for everyone who isn't a friend; it never says WHY
   (newcomer or chosen), because that is theirs to keep.
   ===================================================================== */
export function friendsOnly(error) {
  return error?.code === 'SB002';
}

export default function FriendsOnly({ handle }) {
  const [state, setState] = useState('idle');   // idle | busy | sent | err

  async function ask() {
    setState('busy');
    const { data, error } = await browserClient().rpc('request_friend', { target_handle: handle });
    if (error) { setState('err'); return; }
    setState(data === 'accepted' ? 'accepted' : 'sent');
  }

  return (
    <div className="fo-box">
      <b>They&rsquo;re only taking messages from friends right now</b>
      Send a friend request instead, and if they accept, you can chat.
      {state === 'sent' || state === 'accepted' ? (
        <p className="pushon" style={{ margin: '8px 0 0' }}>
          {state === 'accepted' ? '✓ You’re friends now. Tap Message again.' : '✓ Friend request sent'}
        </p>
      ) : (
        <button type="button" className="btn" disabled={state === 'busy'} onClick={ask}>
          {state === 'busy' ? 'One second…' : 'Send friend request'}
        </button>
      )}
      {state === 'err' && <div className="err">Couldn&rsquo;t send that. Try again.</div>}
    </div>
  );
}
