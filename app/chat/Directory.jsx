'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   EVERYBODY — the member directory inside Chat.

   Ty, Aug 17: "everybody that's in Sober Book should be in the chat. We
   need to make it look more lively."

   The list solves a real problem: before this, the only way to message
   somebody was to stumble across one of their posts and tap through to
   their profile. If you hadn't seen them post, they didn't exist.

   ---------------------------------------------------------------------
   ⚠️ WHY THERE ARE NO GREEN AND RED DOTS

   Ty asked for online/offline indicators. We talked it through and he
   chose this version instead. Writing down why, so nobody adds them back
   in six months thinking it's an obvious missing feature:

   1. `[C] Building for Women.md` calls a public day-count badge the
      sharpest risk in the whole app — "predators filter for newcomers,
      take away the filter." A green dot is that filter with a clock on
      it. It doesn't only say who is vulnerable, it says WHEN they are
      awake and alone. Green at 2am is the exact person and the exact
      moment a 13th stepper looks for.

   2. Over a week, presence publishes somebody's whole schedule. For a
      person avoiding an ex or a dealer, that is genuinely dangerous.

   3. We already refused the two quiet versions of this — no typing dots,
      no "seen" ticks — because both announce that you opened the app.
      A presence dot is the loud version of the same signal.

   4. And the practical one: with four members, three grey dots make the
      room look DEAD. Presence only reads as lively at a few hundred
      people. It would have achieved the opposite of what was asked.

   ---------------------------------------------------------------------
   WHAT MAKES IT FEEL ALIVE INSTEAD

   Every signal on this page comes from something the person chose to do
   in public — never from whether the app is open on their phone.

     "new here"      → joined in the last 7 days
     milestone chip  → derived from their own day count
     "Posted today"  → their newest post UNDER THEIR OWN HANDLE
                       (anonymous posts are excluded in the view — see
                        0017; counting them would leak that an anonymous
                        member was active)

   "New here" is the one that matters most. A green dot marks a newcomer
   as findable. "New here" asks somebody to go and welcome her. Same
   fact, opposite instruction.
   ===================================================================== */

/* =====================================================================
   THE CHIP.

   Metal tiers, the way medallions actually work: you hold your 30-day
   chip until you earn the 60. Copper for the first week, bronze to a
   month, silver at 30/60/90, gold at six months and a year, platinum
   past two.

   ⚠️ PLENTY OF PEOPLE HERE WILL HAVE NO CHIP AT ALL, AND THAT IS FINE.

   Ty, Aug 17: "some people that sign up may not have a problem... maybe
   they just wanna check out and see what's going on, or learn a little
   about recovery and mental health."

   The sober date is optional at signup and it stays optional forever.
   Somebody with no date gets **no chip and no explanation** — not a
   placeholder, not a dash, not an empty slot where a chip should be, and
   absolutely not a "supporter" or "ally" badge.

   The badge idea is the trap. A label for people without a date would
   create a visible two-class room, and worse, it would out everybody who
   DOES have one by contrast. The absence has to be genuinely invisible or
   it isn't neutral. A row with no chip should read as a person, not as a
   person missing something.

   This function returning null is that decision, in one line.
   ===================================================================== */
function chipFor(days) {
  if (days == null) return null;               // no date, no chip, no comment

  /* 🔴 THIS USED TO STOP AT "10 years" AND CALL IT DONE.

     Aug 25: Molly O'Neill joined. Her sober date is 17 February 1985 —
     15,165 days, FORTY-ONE YEARS. Her row said "10 years". Jacoby, at
     eleven, said "10 years" too.

     ⭐ A ceiling on a recovery count is not a rounding error. The whole
     premise of this app is that nobody has to explain themselves and
     nobody's time gets discounted — and the first thing it did to the
     person with the most time in the room was take thirty-one years off
     her. That is the kind of thing somebody notices once and never
     mentions, and then quietly stops opening the app.

     So above a year it just says the number. No cap, ever.

     ⚠️ Years are derived from DAYS here, not from the date, because
     public_profiles deliberately doesn't hand out anybody's sober_since —
     the date itself identifies a person far more than a count does. So
     this uses the mean Gregorian year (365.2425), which can read one day
     early on the morning of an anniversary. That is acceptable for a chip
     on a directory row and NOT acceptable on the profile, which is why
     lib/milestones.js works off real calendar anniversaries instead (the
     Aug 9 rule: year marks are calendar dates, never 365×n). Two
     different jobs, deliberately two different methods. */
  if (days >= 365) {
    const y = Math.floor(days / 365.2425);
    const label = `${y} year${y === 1 ? '' : 's'}`;
    /* Metal keeps the medallion logic: gold through the first year and a
       half-decade, platinum once you're past two. */
    return { t: y >= 2 ? 'platinum' : 'gold', l: label };
  }
  if (days >= 180)  return { t: 'gold',     l: '6 months' };
  if (days >= 90)   return { t: 'silver',   l: '90 days'  };
  if (days >= 60)   return { t: 'silver',   l: '60 days'  };
  if (days >= 30)   return { t: 'silver',   l: '30 days'  };
  if (days >= 7)    return { t: 'bronze',   l: `Day ${days}` };
  return              { t: 'copper',   l: `Day ${days}` };
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/* The one line under the name. Order matters: the most human fact wins.
   Somebody's first week is more worth saying than what they posted. */
function line(m) {
  const joined = daysSince(m.joined_at);
  if (joined !== null && joined < 1) return 'Joined today';
  if (joined !== null && joined < 7) return 'Joined this week';

  const posted = daysSince(m.last_public_post);
  if (posted !== null) {
    if (posted < 1)  return 'Posted today';
    if (posted < 7)  return 'Here this week';
    if (posted < 30) return 'Here this month';
  }
  return 'Member';
}

export default function Directory({ members }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  /* By handle, never by id — public_profiles deliberately doesn't carry
     anybody's uuid. start_thread() is the only thing allowed to turn one
     into the other, and it does that inside the database. */
  async function open(handle) {
    setBusy(handle); setErr('');
    const supabase = browserClient();
    const { data, error } = await supabase.rpc('start_thread', { target_handle: handle });
    if (error || !data) {
      setBusy(null);
      /* ⚠️ One sentence for four different failures — no such handle,
         suspended, they blocked you, you blocked them. Never say which.
         An error message is an output channel (Aug 6). */
      setErr(error?.message || 'Couldn’t open that.');
      return;
    }
    window.location.href = `/chat/${data}`;
  }

  if (!members.length) {
    return (
      <div className="empty">
        <div className="h">Just you so far</div>
        <p className="p">When somebody else joins, they’ll show up here.</p>
      </div>
    );
  }

  return (
    <>
      {err && <div className="err">{err}</div>}
      {members.map((m) => {
        const joined = daysSince(m.joined_at);
        const isNew = joined !== null && joined < 7;
        /* null when they have no sober date, and null when they've chosen
           to keep their count private — the view returns NULL for both, and
           this page cannot tell them apart. That's the point: "hidden" has
           to be indistinguishable from "never set" or the setting
           advertises what it's hiding. */
        const chip = chipFor(m.day_count);
        return (
          <button key={m.handle} className="crow drow" disabled={busy === m.handle}
                  onClick={() => open(m.handle)}>
            <div className="cav" aria-hidden="true">{m.display_avatar || '🙂'}</div>
            <div className="cwho">
              <span className="cname">
                {m.display_name}
                {chip && <span className={'dchip m-' + chip.t}>{chip.l}</span>}
                {!chip && isNew && <span className="dchip new">new here</span>}
              </span>
              <span className="clast">{line(m)}</span>
            </div>
            {/* "Say hi" on somebody's first week is the whole point of the
                chip — it turns a list into an instruction. */}
            <span className="dgo">{busy === m.handle ? '…' : isNew ? 'Say hi' : 'Message'}</span>
          </button>
        );
      })}
    </>
  );
}
