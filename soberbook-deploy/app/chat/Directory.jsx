'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import RowMenu from '../friends/RowMenu';

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

/* =====================================================================
   THE QUIET CHIP — the Community page's version, and the only one that
   page ever shows.

   Ty, 29 Aug: "Instead of adding their sober date, add the days they've
   been quiet. So we know who isn't talking or not."

   ⭐ THIS IS THE SAME ROW ANSWERING A DIFFERENT QUESTION. A sober date
   on a member list answers "who is newest". Days-quiet answers "who has
   gone silent" — the thing a friend notices. It is the friends page's
   "It's been a while" rule applied to the whole room.

   ⚠️ GOLD, NEVER RED. Copied deliberately from the friends page: this is
   a nudge to go and check on somebody, not a mark against them. Nobody
   is in trouble for being quiet.

   ⚠️ NOTHING UNDER SEVEN DAYS. A chip on everybody is wallpaper — if
   every row is flagged, no row is. Under a week there is nothing to do.

   ⚠️ SOMEBODY NEW WITH NOTHING SAID YET FALLS THROUGH TO "new here"
   rather than getting a silence chip, because on day three the honest
   reading is "they have just arrived", not "they have gone quiet".
   Past a week that flips, and "Hasn't posted yet" is the actionable one.

   ⚠️ Returns null when quiet_days is undefined, which is what makes the
   Chat directory — fed by public_profiles, which has no quiet_days —
   carry on showing its milestone chips exactly as before. Two lists, two
   chips, one component, and neither one guesses. */
function quietChip(m) {
  if (m.quiet_days == null) return null;
  const joined = daysSince(m.joined_at);

  if (m.never_spoken) {
    if (joined !== null && joined < 7) return null;   // "new here" instead
    return { t: 'quiet', l: 'Hasn’t posted yet' };
  }
  if (m.quiet_days >= 7) return { t: 'quiet', l: `Quiet ${m.quiet_days} days` };
  return null;
}

/* ⚠️ ONE OPEN QUESTION ABOUT chipFor, DELIBERATELY LEFT ALONE (29 Aug).

   Under 30 days that function prints a literal `Day 3` / `Day 12`. It was
   briefly changed to print nothing, on the argument that a day number
   beside a name — on a scrollable list of every member — is the newcomer
   filter this app refused when it refused presence dots, and that
   `[C] Building for Women.md` names exactly that as the sharpest risk in
   the product. It is also on by default: day_count_visibility is
   'everyone' for all 18 members and nobody chose it.

   Ty looked at it and said leave it as it is. His call, and it stands.
   Recorded here rather than argued again, so that whoever reads this next
   knows the question was asked and answered rather than never noticed.

   ⚠️ The related render order is worth knowing: the row draws the chip
   first and only falls back to "new here" when there ISN'T one, so a
   newcomer WITH a sober date gets the day number rather than the welcome.
   The Community page does not have this problem — it has no day counts at
   all, so its newcomers get "new here". */

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/* The one line under the name. Order matters: the most human fact wins.
   Somebody's first week is more worth saying than what they posted. */
function line(m) {
  const joined = daysSince(m.joined_at);

  /* ---- the Community page's wording ----
     ⚠️ Branches on quiet_days being PRESENT, not on a page name or a prop
     the caller passes down. The two mounts of this component differ by
     the shape of their data and nothing else, so the component asks the
     data. A `variant="community"` prop would be a second source of truth
     about which page you are on, and the wrong one would render silently.

     ⚠️ "Talked", not "posted" — a reply counts as talking, and the number
     behind this counts replies. The word has to match what was measured
     or the row quietly lies. */
  if (m.quiet_days != null) {
    if (m.never_spoken) {
      return joined === null ? 'Nothing posted yet'
           : joined < 1      ? 'Joined today'
           : `Here ${joined} day${joined === 1 ? '' : 's'}, nothing yet`;
    }
    if (m.quiet_days < 1) return 'Talked today';
    if (m.quiet_days < 2) return 'Talked yesterday';
    return `Last talked ${m.quiet_days} days ago`;
  }

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
        /* ⚠️ Two chips, and a row never carries both — Chat is fed by
           public_profiles (day_count, no quiet_days) and Community by
           community_members() (quiet_days, no day_count), so exactly one
           of these is ever non-null. Quiet wins if it's there, because on
           that page it IS the page. */
        const chip = quietChip(m) || chipFor(m.day_count);
        return (
          /* ⚠️ The ⋯ is a SIBLING of the row button, never a child of it.
             A <button> inside a <button> is invalid HTML and browsers
             recover from it differently — the inner one stops being
             reliably tappable. Same reason the Wall's reply preview sits
             outside its post button. The wrapper is positioned and the ⋯
             is placed over the row's right edge, so the row's own flex
             layout (from wall.css) is left completely untouched. */
          <div key={m.handle} className="drowwrap">
          <button className="crow drow" disabled={busy === m.handle}
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
          {/* ⚠️ Not rendered on your own row — there is no version of
              blocking or reporting yourself that means anything, and an
              option that can only fail is worse than no option. */}
          {!m.is_mine && (
            <RowMenu handle={m.handle} name={m.display_name}
                     onMessage={() => open(m.handle)} />
          )}
          </div>
        );
      })}
    </>
  );
}
