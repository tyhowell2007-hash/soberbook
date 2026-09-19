'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import StoryViewer from './StoryViewer';
import StoryComposer from './StoryComposer';
import ArtistCheck from './ArtistCheck';

/* =====================================================================
   THE RAIL.  18 Sept 2026.

   ⭐ WHY STORIES BELONG ON THIS APP, written down so nobody removes them
   for being a copy of Instagram. A story is gone in a day. That is the
   only place in Sober Book somebody can say "today was bad" without it
   sitting under their name for a year. The disappearing is the feature,
   not the decoration.

   ⚠️ EVERYBODY IS THEIR HANDLE HERE. Not display_name, which on the wall
   is a real first name for anyone on privacy_mode='open'. story_rail()
   enforces that in SQL (0173) — this file just renders what it is given
   and must never "improve" it by reaching for a nicer name.

   🔴 VIEWERS ARE COUNTED, NEVER LISTED. Ty's call, and the reason is the
   quiet check: somebody looking in on a friend's 3am story should not
   have their handle put in front of that friend. The count comes back
   from story_open() only on your own stories; nothing in this component
   can ask who watched, because nothing in the database will answer.
   ===================================================================== */

export default function StoryRail() {
  const supabase = browserClient();
  const [rail, setRail] = useState([]);
  const [openAt, setOpenAt] = useState(null);   // index into rail
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('story_rail');
    const rows = data || [];
    /* 🔴 19 Sept. story_rail() hands back an avatar as a STORAGE PATH
       ("avatars/….webp"), not a URL — the bucket is private. Dropped into
       <img src> as-is it is a broken picture on every circle whose owner
       has a profile photo. So the paths go through /api/photo/sign, the
       same door the wall uses, which asks public_profiles whether this
       viewer may see that face. Anything it refuses to sign becomes null
       and the circle falls back to the emoji or the initial — never a
       broken image, and never a photo the views would have hidden.
       The viewer is handed these same rows, so it is fixed too. */
    const isPath = (p) => typeof p === 'string' && p && !/^(https?:|blob:|data:)/.test(p);
    const paths = [...new Set(rows.map((r) => r.display_avatar_photo).filter(isPath))];
    let urls = {};
    if (paths.length) {
      try {
        const res = await fetch('/api/photo/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        });
        urls = (await res.json()).urls || {};
      } catch {
        /* A circle with an initial beats an error over the wall. */
      }
    }
    setRail(rows.map((r) => (isPath(r.display_avatar_photo)
      ? { ...r, display_avatar_photo: urls[r.display_avatar_photo] || null }
      : r)));
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const mine = rail.find((r) => r.is_mine) || null;
  /* ⚠️ Yours is drawn from its own slot at the front, so it is removed
     from the scrolling list — otherwise you appear twice the moment you
     post, which reads as a bug rather than as a feature. */
  const others = rail.filter((r) => !r.is_mine);

  /* Nothing to show and nothing to add is not an empty rail — it is no
     rail. A row of one grey circle on an otherwise busy wall is clutter
     that teaches people the feature is broken. */
  if (!rail.length && !mine) {
    return (
      <>
        <div className="sty-rail">
          <Slot me add onClick={() => setComposing(true)} />
        </div>
        {/* ⚠️ OUTSIDE the rail, as in the branch below. The rail is a
            sideways scroller, and a fixed overlay nested in one is at the
            browser's mercy on iOS. */}
        {composing && <StoryComposer onClose={() => { setComposing(false); load(); }} />}
      </>
    );
  }

  return (
    <>
      <div className="sty-rail" role="list" aria-label="Stories">
        <Slot
          me
          add={!mine}
          row={mine}
          onClick={() => (mine ? setOpenAt(rail.indexOf(mine)) : setComposing(true))}
        />
        {others.map((r) => (
          <Slot key={r.author_id} row={r} onClick={() => setOpenAt(rail.indexOf(r))} />
        ))}
      </div>

      {openAt !== null && (
        <StoryViewer
          rail={rail}
          startAt={openAt}
          onClose={() => { setOpenAt(null); load(); }}
        />
      )}
      {composing && <StoryComposer onClose={() => { setComposing(false); load(); }} />}
    </>
  );
}

/* One circle. ⚠️ A <button>, not a div with onClick — the rail is the
   entry point to a whole feature and Tab has to reach it. */
function Slot({ row, me = false, add = false, onClick }) {
  const seen = row ? row.all_seen : false;
  const name = me ? 'Your story' : (row ? row.display_name : '');

  return (
    <button type="button" className={'sty-item' + (add ? ' sty-add' : '')}
            onClick={onClick} role="listitem"
            aria-label={add ? 'Add to your story'
                            : `${name}, ${row?.live_count || 0} ${(row?.live_count || 0) === 1 ? 'story' : 'stories'}${seen ? ', seen' : ''}`}>
      <span className="sty-wrap">
        <span className={'sty-ring' + (seen && !add ? ' sty-seen' : '')}>
          <span className="sty-face">
            {row?.display_avatar_photo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={row.display_avatar_photo} alt="" />
              : (row?.display_avatar || (name ? name.slice(0, 1).toUpperCase() : '🌱'))}
          </span>
        </span>
        {add && <span className="sty-plus" aria-hidden="true">+</span>}
      </span>
      <span className="sty-name">{name}{!me && row && <ArtistCheck handle={row.display_name} />}</span>
    </button>
  );
}
