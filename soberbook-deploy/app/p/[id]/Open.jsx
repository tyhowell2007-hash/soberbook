'use client';

import { useRouter } from 'next/navigation';
import Thread from '../../wall/Thread';

/* ⭐ THE WHOLE POINT: this reuses Thread.jsx rather than re-rendering a
   post and its replies a second time.

   The reply composer, the anonymous toggle, the per-thread alias, the
   "nobody posts into silence here" empty state and the feed_comments read
   all already existed — they just had no URL. Rebuilding any of it here
   would be the 0046 → 0047 → 0049 mistake again: a rule written twice,
   then edited once.

   ⚠️ Thread requires onClose. On the wall that dismisses an overlay; here
   there is nothing underneath, so it has to GO somewhere. back() would
   send somebody who arrived from a push notification to whatever they
   were reading before the app opened — which might be nothing at all. The
   wall is the honest destination. */
export default function Open({ post }) {
  const router = useRouter();
  return (
    <Thread
      post={post}
      onClose={() => router.push('/wall')}
      onCountChange={() => { /* no card behind this one to update */ }}
    />
  );
}
