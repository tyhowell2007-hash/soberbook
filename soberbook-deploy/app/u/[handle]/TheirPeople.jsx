'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';
import './their-people.css';

/* =====================================================================
   WHO THEY KNOW — AND ONLY IF YOU ALREADY KNOW THEM.  26 Sept.

   Ty moved the August line this far and no further: a member's friends
   are visible to the people that member has already accepted, and to
   nobody else. A stranger's page keeps the COUNT and no names, exactly
   as it has since August.

   🔴 THE NUMBERS THAT DECIDED THE SHAPE OF THIS. Of the 37 members
   currently on somebody's friend list, 31 have turned OFF "findable by
   name" and 11 are in anonymous mode. Publishing those lists to the
   whole app would have put every one of them on someone else's page
   retroactively, for a friendship they accepted when the list was
   private. Friends-only is the version where the people already in the
   room are the only ones who see it.

   ---------------------------------------------------------------------
   ⚠️ THREE THINGS THIS DELIBERATELY DOES NOT SHOW, and each one is a
   leak the obvious version ships:

   1. NO QUIET DAYS. app/me/People.jsx prints how long since you last
      spoke to each person. That belongs on YOUR page and nowhere else —
      shown to anybody else it publishes who has gone silent.

   2. NO MEANINGFUL ORDER. friends_of_member() returns alphabetical by
      handle on purpose. Sorting by recency would leak the same fact
      through the ordering with the numbers stripped off.

   3. NO PHOTOS. The letter tile, same as the /me grid: a signed URL per
      face would add a round trip each, and an expired one renders
      broken. The tint is derived from the handle so a person looks the
      same every visit.

   ⚠️ THE GUARD IS IN THE DATABASE, NOT HERE. friends_of_member() returns
   an empty set to anyone who is not the member or an accepted friend.
   This component cannot show what it is not given, and hiding the
   section in the UI would not be a control — it would be a curtain.
   ===================================================================== */

const TINTS = ['tp-green', 'tp-lilac', 'tp-rose', 'tp-blue', 'tp-sand'];
function tintFor(handle) {
  let h = 0;
  for (const ch of String(handle)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/* 🔴 FALLS BACK TO THE HANDLE. 186 of 197 members have never set a
   display name, so `{p.display_name}` alone renders a zero-height blank
   under the tile — found live on the /me grid, not reasoned about. */
function nameOf(p) {
  return p.display_name || `@${p.handle}`;
}

const FIRST = 9;

export default function TheirPeople({ handle, name }) {
  const [people, setPeople] = useState(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    browserClient()
      .rpc('friends_of_member', { target_handle: handle })
      .then(({ data }) => { if (live) setPeople(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setPeople([]); });
    return () => { live = false; };
  }, [handle]);

  /* ⚠️ NOTHING AT ALL WHILE LOADING, AND NOTHING WHEN EMPTY. A stranger
     gets an empty set from the function, so this renders nothing and the
     page looks exactly as it did before — no heading, no "you can't see
     this", no shape where a list would be. A section that announces its
     own absence tells a stranger there is something here. */
  if (people === null || people.length === 0) return null;

  const shown = all ? people : people.slice(0, FIRST);
  const who = name || `@${handle}`;

  return (
    <section className="tpwrap">
      <div className="tphead">
        <h2 className="tptitle">Who {who} knows</h2>
        <span className="tpcount">{people.length}</span>
      </div>

      {/* ⚠️ Says plainly why this is on the page, because a friends list
          appearing on somebody's profile is exactly the thing members
          were promised would not happen in public. Telling them who can
          see it is the difference between a feature and a surprise. */}
      <p className="tpwhy">Because you two are friends. Nobody else sees this.</p>

      <ul className="tpgrid">
        {shown.map((p) => (
          <li key={p.handle} className="tpitem">
            <Link href={`/u/${p.handle}`} className="tplink">
              <span className={'tpface ' + tintFor(p.handle)} aria-hidden="true">
                {p.display_avatar
                  || String(p.display_name || p.handle).slice(0, 1).toUpperCase()}
              </span>
              <span className="tpname">{nameOf(p)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {people.length > FIRST && (
        <div className="tpmore">
          <button type="button" className="tpall" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `See all ${people.length} ›`}
          </button>
        </div>
      )}
    </section>
  );
}
