'use client';

import { useState } from 'react';
import Link from 'next/link';

/* =====================================================================
   YOUR PEOPLE — the friends grid on your own page.

   🔴 WHY IT IS HERE AND NOWHERE ELSE. Ty asked where friends go once
   they pile up. They were already going somewhere: a list at the BOTTOM
   of the Community page, 19,550px down a 20,072px page — twenty-five
   screens past the 238-member directory. Measured, not guessed. Built,
   correct, and unreachable.

   ⚠️ THIS DELIBERATELY DOES NOT EXIST ON SOMEBODY ELSE'S PROFILE.
   `app/u/[handle]/page.jsx` has refused a public friends list since
   August — *"a public friend list is a map of who in recovery knows
   whom; being on somebody's list outs you by association."* I drew one
   anyway, Ty was shown the reversal, and he kept the refusal. `0155`
   dropped the function I had written for it. A stranger's page keeps the
   COUNT and no names.

   ---------------------------------------------------------------------
   ⭐ THE ORDER IS THE FEATURE, and it is the same instinct as the
   Community list: my_friends() returns quietest-first, so the person you
   have not heard from is the first face you see. Every other friends
   list on earth sorts by who is loudest.

   ⚠️ ONLY YOU EVER SEE THAT ORDER, and the days only render here. On any
   public surface it would publish who has gone silent — the presence-dot
   problem with a friendlier face on it.
   ===================================================================== */

/* ⚠️ The tint is derived from the handle, so a person is the same colour
   every time you open the page. Random-per-render would make the grid
   flicker into a different picture on every visit, which is the opposite
   of somewhere your people live. */
const TINTS = ['pp-green', 'pp-lilac', 'pp-rose', 'pp-blue', 'pp-sand'];
function tintFor(handle) {
  let h = 0;
  for (const ch of String(handle)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/* Two weeks. Same threshold as the Community list — long enough not to
   nag about somebody you spoke to on Tuesday, short enough to still be a
   check-in rather than an autopsy. */
const AWHILE = 14;

/* ⚠️ WHOLE DAYS, NEVER CLOCK TIMES. "2:14am" says what somebody's night
   looked like; "3 days ago" says only what it needs to. */
function whenWord(p) {
  if (p.never_talked) return 'not yet';
  const d = p.quiet_days;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

function quietWord(p) {
  if (p.never_talked) return 'not talked yet';
  return `quiet ${p.quiet_days} days`;
}

const FIRST = 6;

export default function People({ friends = [] }) {
  const [all, setAll] = useState(false);

  /* 🔴 NO ZERO, AND NO COUNT AT ALL WHEN THERE ARE NONE. 236 of 243
     members have no friends yet, so this is the state most people meet.
     "Your people · 0" on your own page is a scoreboard telling you that
     you lost — the same reason the open-room card never prints a zero and
     a room message with no hearts shows no number. */
  if (!friends.length) {
    return (
      <section className="ppwrap">
        <div className="ppcard">
          <div className="pphead">
            <span className="pptitle">Your people</span>
          </div>
          <div className="ppempty">
            <p>Nobody yet. When somebody asks to be your friend and you say yes,
               they land here.</p>
            <Link href="/find" className="ppfind">Find people ›</Link>
          </div>
        </div>
      </section>
    );
  }

  const quiet = friends.filter((f) => f.never_talked || (f.quiet_days ?? 0) >= AWHILE);
  const shown = all ? friends : friends.slice(0, FIRST);

  return (
    <section className="ppwrap">
      <div className="ppcard">
        {/* The bar is the printed, deliberate part — it stops the section
            floating on the page. White on --gd measures 6.46. */}
        <div className="pphead">
          <span className="pptitle">Your people</span>
          <span className="ppcount">{friends.length}</span>
        </div>

        {quiet.length > 0 && (
          <p className="ppnote">
            {quiet.length === 1
              ? `${quiet[0].display_name} has been quiet a while.`
              : `${quiet.length} of them have been quiet a while.`}
          </p>
        )}

        <ul className="ppgrid">
          {shown.map((p) => {
            const isQuiet = p.never_talked || (p.quiet_days ?? 0) >= AWHILE;
            return (
              <li key={p.handle} className="ppitem">
                <Link href={`/u/${p.handle}`} className="pplink">
                  {/* ⚠️ A photo avatar falls back to the letter tile here
                      rather than rendering the picture: a signed URL for
                      every face would put six more signing round trips on
                      a page that already has plenty, and an expired one
                      renders a broken image. The tint plus the initial is
                      stable and never breaks. */}
                  <span className={'ppface ' + (isQuiet ? 'pp-quiet' : tintFor(p.handle))}
                        aria-hidden="true">
                    {p.avatar || String(p.display_name || p.handle).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="ppname">{p.display_name}</span>
                  <span className={'ppwhen' + (isQuiet ? ' on' : '')}>
                    {isQuiet ? quietWord(p) : whenWord(p)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {friends.length > FIRST && (
          <div className="ppmore">
            {/* ⚠️ It expands in place rather than going to a new page. A
                separate /friends-of-mine route is one more thing to find,
                and this list is short enough to live where it belongs. */}
            <button type="button" className="ppall" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `See all ${friends.length} ›`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
