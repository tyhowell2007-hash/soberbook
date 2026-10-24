import Shot from './Shot';
import './gallery.css';

/* =====================================================================
   SOMEBODY'S PROFILE PHOTOS. 23 Oct (0190).

   Ty: "let's allow everybody in the app to post more than one picture on
   their profile page… pictures of themselves or other things."

   ⭐ This is a READ-ONLY renderer and it decides nothing. The caller
   hands it the paths it was given and the urls that were signed for
   them, and both of those came out of `public_profiles` — the view that
   already knows about anonymous mode, blocks, suspension and deletion.
   Nothing about WHO may see these is settled in this file, deliberately,
   because a second copy of that rule is a copy that drifts.

   ⚠️ IT RENDERS NOTHING RATHER THAN AN EMPTY HEADING. A member who has
   put nothing up should leave no trace on their own page — a "Photos"
   tab opening onto "nothing here yet" is a nothing-here line wearing a
   tab, and the same argument ProfileTabs already makes about About.

   ⚠️ `Shot`, not <img>. These are signed urls, they expire in an hour,
   and a lazy image fetched on scroll after that is a broken-image icon.
   Shot repairs itself once per path. That bug cost a whole evening on
   5 Sept and this component would have reintroduced it exactly.
   ===================================================================== */
export default function Gallery({ paths, urls, mine = false }) {
  /* Only pictures that actually got a url. An unsigned path is one the
     view refused to vouch for, and the honest thing to draw for it is
     nothing at all. */
  const live = (paths || []).filter((p) => urls && urls[p]);
  if (!live.length) return null;

  /* The whole set, so the arrows in the full-screen viewer can walk from
     one picture to the next instead of opening one and dead-ending. */
  const items = live.map((p) => ({ path: p, url: urls[p] }));

  return (
    <div className="ublk">
      <h2 className="sec">{mine ? 'Your photos' : 'Their photos'}</h2>
      <div className="gal">
        {live.map((p, i) => (
          <Shot key={p} path={p} src={urls[p]} zoom={{ items, i }}
                alt={`Photo ${i + 1} of ${live.length}`} />
        ))}
      </div>
      <p className="galn">
        {live.length === 1 ? '1 photo' : `${live.length} photos`}
        {' · tap one to see it full size'}
      </p>
    </div>
  );
}
