'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import StoryViewer from './StoryViewer';
import StoryComposer from './StoryComposer';

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
    setRail(data || []);
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
      <div className="sty-rail">
        <Slot me add onClick={() => setComposing(true)} />
        {composing && <StoryComposer onClose={() => { setComposing(false); load(); }} />}
      </div>
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
      <span className="sty-name">{name}</span>
    </button>
  );
}
