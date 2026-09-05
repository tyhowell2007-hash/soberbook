'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE PLEDGE, ON YOUR OWN PAGE.  1 Sept.

   Ty: "I thought about putting it on every user's profile. Underneath or
   just right above their song." — so it sits directly above the anthem.

   ---------------------------------------------------------------------
   🔴 THIS FILE IS Me.jsx ONLY. IT IS NOT RENDERED BY /u/[handle], AND
   THAT IS THE WHOLE DESIGN, NOT AN OVERSIGHT.

   Ty was explicit that this "takes nothing away from the clock above
   their profile. That stays... this will be more of, like, personal
   stuff." The day count is the public number and always has been. The
   pledge is the private one.

   ⚠️ AND THE DATABASE AGREES, WHICH IS THE PART THAT MATTERS. There is
   no policy, view or function anywhere in the schema that returns
   another member's pledge row — not to friends, not to the owner, not
   to /admin. If somebody later decides a streak should show on public
   profiles, that is a migration and it should feel like one. Nothing
   here is switched off in the UI; there is nothing to switch on.

   ⚠️ THE ONE EXCEPTION, AND ITS SHAPE IS DELIBERATE: pledges_today_count()
   returns an INTEGER. No handles, no rows, no filter argument. Same rule
   /admin/numbers lives by — the count exists so nobody feels alone, and
   it can't be turned into a list of who.

   ---------------------------------------------------------------------
   ⚠️ WHY NOT A STREAK ON THE PUBLIC PROFILE, given the app already shows
   day counts there: a public streak turns "I said one more day" into a
   performance, and the moment it can be SEEN to break, the honest thing
   (saying it again on day 1) becomes the visibly embarrassing thing.
   That is precisely the mechanic this feature was built to refuse.
   ===================================================================== */

export default function PledgeRecord() {
  const [s, setS] = useState(null);

  useEffect(() => {
    browserClient().rpc('my_pledge_stats')
      .then(({ data }) => setS(Array.isArray(data) ? data[0] : data))
      .catch(() => setS(false));
  }, []);

  if (s === null || s === false) return null;

  /* ⚠️ NEVER SAID IT AND NEVER WILL BE NAGGED ABOUT IT HERE. Somebody
     who has never pledged sees nothing at all on this page — the ask
     lives on Home, once a day, and that is the only place it lives.
     A permanent "0 in a row · 0 times altogether" on your own profile is
     the app keeping score of something you didn't sign up for, which is
     the same reasoning that hides the empty blocked list. */
  if (!s.lifetime) return null;

  return (
    <div className="plr">
      <p className="plr-lbl">One more day</p>

      <p className="plr-n">
        {s.streak === 0
          ? '—'
          : s.streak === 1 ? 'Day 1' : s.streak}
      </p>
      <p className="plr-sub">
        {s.streak === 0
          /* ⚠️ NOT "you broke your streak". The number is simply not
             running today, and saying it that way costs nothing. */
          ? 'not said today'
          : s.streak === 1 ? 'said it today' : 'days in a row'}
      </p>

      {/* ⭐ THE LIFETIME NUMBER IS THE ONE THAT NEVER GOES BACKWARDS, and
          it is here for the same reason the lifetime sober total exists
          (migration 0010): a streak that resets erases the evidence that
          somebody has been doing this for a year. 212 times is 212 times
          whether or not they missed a Tuesday in March. */}
      <p className="plr-life">
        {s.lifetime} {s.lifetime === 1 ? 'time' : 'times'} altogether
      </p>

      {s.today_why && (
        <p className="plr-why">“{s.today_why}”</p>
      )}

      <p className="plr-priv">Only you see this.</p>
    </div>
  );
}
