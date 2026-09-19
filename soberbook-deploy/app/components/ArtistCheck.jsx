'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE GOLD CHECKMARK.  19 Sept 2026.

   One request per page load, shared by every name on the page: the first
   ArtistCheck to mount asks artist_handles() and every other one waits on
   the same promise. The answer is a handful of handles — being a verified
   artist is public, that is the point of it.

   🔴 IT IS KEYED ON author_handle, AND THAT IS THE SAFETY MECHANISM.
   feed_posts and feed_comments return author_handle NULL on anonymous
   posts, so an anonymous post has nothing to match and can never wear a
   checkmark. Never key this on display_name — an anonymous alias could
   collide with a real handle. artist_handles() also leaves out anyone in
   anonymous mode.
   ===================================================================== */
let asked = null;
function artistSet() {
  if (!asked) {
    asked = browserClient().rpc('artist_handles')
      .then(({ data }) => new Set((data || []).map((h) => String(h).toLowerCase())))
      .catch(() => new Set());
  }
  return asked;
}

export default function ArtistCheck({ handle }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!handle) return undefined;
    let live = true;
    artistSet().then((s) => { if (live) setOn(s.has(String(handle).toLowerCase())); });
    return () => { live = false; };
  }, [handle]);
  if (!on) return null;
  return (
    <svg className="gchk" viewBox="0 0 24 24" role="img" aria-label="Verified artist">
      <title>Verified artist</title>
      <circle cx="12" cy="12" r="11" />
      <path d="M7 12.5l3.2 3.2L17.2 8.6" />
    </svg>
  );
}
