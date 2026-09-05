'use client';

/* =====================================================================
   THE NEW PROFILE CONTROLS — 2 Sept 2026.

   Sponsoring (two facts), your path (41 options), the eight themes, your
   handle, and who can see your day count.

   ⭐ WHY THEY LIVE HERE AND NOT IN Me.jsx. That file was 92KB before
   tonight and would have been 108KB after. It is already the largest
   component in the app and the hardest to deploy — the 23 Aug lesson
   was wall.css failing to upload three times at 71KB, and the fix then
   was the same as the fix now: split the file rather than keep pushing
   a bigger one through a pipe that has already shown you its limit.

   ⚠️ EVERY COMPONENT HERE IS PRESENTATION PLUS ONE CALLBACK. They hold
   no state of their own and they never touch Supabase. `save` comes in
   as a prop and is the SAME save() the rest of /me uses — one save path,
   one error translator, one router.refresh(). A second save function in
   here would be the 0046 → 0049 drift with a new hat on.

   ⚠️ 'use client' is REQUIRED. These are all onClick handlers, and
   Me.jsx (itself a client component) imports them. A server file must
   never import a NAMED export from this module — that is the bug that
   took /wall down on 2 Sept: Next turns every export of a client module
   into a client reference, so the function arrives on the server as a
   proxy and calling it throws. Me.jsx is a client component, so the
   named imports below are safe.
   ===================================================================== */

/* 🔴 THE PATHS. Ty's list: "it needs to be more than just NA, SMART
   Recovery, AA, religion… use all those as options."

   ⚠️ Group ORDER is deliberate and is not alphabetical. Twelve-step
   first because it is what most people arrive already knowing, and
   medication FOURTH rather than last so it reads as one route among
   several rather than an afterthought. The meeting banner has said
   "all paths welcome — Suboxone included" since August; a picker that
   buried medication at the bottom would have undercut it.

   🔴 These strings ARE the allowlist in 0113's paths_ok(). Adding one
   here without adding it there means the database refuses the save and
   the member gets "that didn't send" with no way to work out why. */
export const PATH_GROUPS = [
  { e: '🔵', n: 'Twelve step',         i: ['AA','NA','CA','CMA','HA','GA','OA','Al-Anon','Nar-Anon'] },
  { e: '🧠', n: 'Not twelve step',     i: ['SMART Recovery','LifeRing','Women for Sobriety','SOS','Recovery Dharma','Refuge Recovery'] },
  { e: '🙏', n: 'Faith',               i: ['Celebrate Recovery','Church','Wellbriety','Millati Islami','Jewish recovery','My own faith'] },
  { e: '💊', n: 'Medication',          i: ['Suboxone','Methadone','Vivitrol','Sublocade','Naltrexone','Antabuse'] },
  { e: '🏥', n: 'Treatment & support', i: ['Therapy','IOP / outpatient','Rehab','Sober living','Peer support','Drug court','Harm reduction'] },
  { e: '🏃', n: 'Every day',           i: ['Meditation','The gym','Running','Music','Service work','My family','Doing it on my own'] },
];

/* 🔴 EIGHT NAMED THEMES, NOT A COLOUR PICKER. MySpace let people pick
   any colour and half of MySpace became unreadable. Every pairing was
   measured before it shipped: ink on background ≥14.6, muted text ≥7.3,
   button text ≥5.1. A member cannot build a page nobody can read.
   ⚠️ The keys must match 0113's CHECK constraint exactly. */
export const THEMES = [
  { k: 'cream',    e: '☕',  n: 'Cream',      dot: '#2A1B0C' },
  { k: 'green',    e: '🌿', n: 'Green room', dot: '#1B6B4A' },
  { k: 'sunset',   e: '🌇', n: 'Sunset',     dot: '#C2410C' },
  { k: 'water',    e: '🌊', n: 'Deep water', dot: '#12557E' },
  { k: 'black',    e: '🖤', n: 'Blackout',   dot: '#D6FF2E' },
  { k: 'bloom',    e: '🌸', n: 'Bloom',      dot: '#A3245C' },
  { k: 'day',      e: '☀️', n: 'Daybreak',   dot: '#8A6A00' },
  { k: 'amethyst', e: '💜', n: 'Amethyst',   dot: '#5B3FB5' },
];

const YNU = [['yes', 'Yes'], ['no', 'No'], ['unsaid', 'Rather not say']];

/* ---------------------------------------------------------------------
   THE EYE. One control, used on sections and on path groups.

   Ty: "have an eye right beside it, and you can toggle it on or off so
   people can see it or not see it."

   ⚠️ preventDefault AND stopPropagation, and both are load-bearing. This
   button renders inside a <summary>, and a click anywhere in a summary
   is the browser's own gesture for opening and closing the <details>.
   Without these, hiding your town would also collapse the section you
   were working in — which reads as the app lurching, not as a setting
   being saved.

   ⚠️ It says the WORD as well as the icon. 👁 alone is not a state: a
   lock and an eye are only distinguishable if you already know the
   convention, and getting this wrong means publishing something you
   believed was private. The label removes the guess.
   --------------------------------------------------------------------- */
/* 🔴 `anon` IS NOT A DISABLED STATE, IT IS A DIFFERENT FACT, AND GETTING
   THAT WRONG IS THE BUG THIS PROP EXISTS TO FIX — 2 Sept.

   An anonymous profile carries no prose at all: public_profiles nulls
   bio, location, programs, interests and every sponsoring flag the
   moment privacy_mode = 'anonymous'. That rule is older than this
   control and it OVERRULES it. So on an anonymous profile the eye was
   sitting in the section header saying "Shown" over content the app
   will never show — and 160 of 191 members are anonymous. Ty found it
   on his phone: "About you isn't showing up even if you leave the eye
   on." He was right, and the eye was the thing lying.

   ⚠️ A SPAN, NOT A DISABLED BUTTON. A disabled button is skipped by
   screen readers and shows no tooltip on touch, so the one person who
   most needs to know why it won't move gets nothing. A span with its
   own visible word says it out loud to everybody.

   ⚠️ IT DOES NOT DISAPPEAR. A control that vanishes is one you never
   learn exists — you'd switch to Open later and have no idea there was
   ever a per-field choice waiting. It greys, it names its reason, it
   stays put. */
export function Eye({ on, onToggle, busy, what, anon }) {
  if (anon) {
    return (
      <span className="eye anon"
            title={'Your profile is set to Anonymous, so ' + what
                   + ' is hidden from everyone no matter what this says.'}>
        <span aria-hidden="true">{'\u{1F512}'}</span>
        <span className="eyeL">Anonymous</span>
      </span>
    );
  }
  return (
    <button type="button" className={'eye' + (on ? '' : ' off')} disabled={busy}
            aria-pressed={!on}
            aria-label={what + ' — ' + (on ? 'shown on your page' : 'hidden from everyone')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>
      <span aria-hidden="true">{on ? '\u{1F441}' : '\u{1F512}'}</span>
      <span className="eyeL">{on ? 'Shown' : 'Hidden'}</span>
    </button>
  );
}


/* ---------------------------------------------------------------------
   SPONSORING — two questions, not one exclusive pick.

   🔴 The old model was ONE value, with a comment arguing that separate
   switches "would let somebody claim they're looking for a sponsor AND
   available to be one, which is a state the world doesn't have."

   ⭐ That was right about one pair and wrong about the other. Having a
   sponsor and being willing to sponsor are not opposites — they are the
   NORMAL combination, because nearly every sponsor has one. The old
   model could not express the most common case in recovery.

   ⚠️ WHAT THE PUBLIC PAGE DOES WITH THESE IS NOT SYMMETRICAL, and the
   asymmetry is the safety:
       yes    → anyone (willing-to-sponsor also needs 365 days)
       no     → ONLY viewers with a year or more
       unsaid → nothing at all
   A public "no" on a newcomer's page is the same beacon as "looking for
   a sponsor", gated since 0031. Under a year a viewer cannot tell
   "didn't answer" from "answered no", and that indistinguishability IS
   the protection. Enforced in public_profiles, never here.
   --------------------------------------------------------------------- */
export function SponsorPair({ hasSp, willSp, spNA, setHasSp, setWillSp, setSpNA, save, busy, days }) {
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Two separate questions. Answer either, both, or neither.
      </p>

      <div className="sqrow">
        <span className="sqL">🤝 Do you have a sponsor?</span>
        <div className="sqBtns">
          {YNU.map(([v, l]) => (
            <button key={v} type="button" disabled={busy}
                    className={'sbpill' + (hasSp === v ? ' sel' : '')}
                    aria-pressed={hasSp === v}
                    onClick={() => { setHasSp(v); setSpNA(false);
                      save({ has_sponsor: v, sponsor_na: false }, 'Saved.'); }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ⚠️ Say the gate out loud. A rule you cannot see just looks like
          the feature is broken — somebody who answers and hears from
          nobody deserves to know it was deliberate. */}
      {hasSp === 'no' && (
        <p className="hint">
          This one stays quiet. Only members with a year or more can see it, so
          it reaches people who&apos;ve been where you are and not a public list
          of who&apos;s new and on their own.
        </p>
      )}

      <div className="sqrow">
        <span className="sqL">🛟 Willing to sponsor someone?</span>
        <div className="sqBtns">
          {YNU.map(([v, l]) => (
            <button key={v} type="button" disabled={busy}
                    className={'sbpill' + (willSp === v ? ' sel' : '')}
                    aria-pressed={willSp === v}
                    onClick={() => { setWillSp(v); setSpNA(false);
                      save({ will_sponsor: v, sponsor_na: false }, 'Saved.'); }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {willSp === 'yes' && days !== null && days < 365 && (
        <p className="hint">
          Saved &mdash; but it won&apos;t show on your page until you&apos;ve got a
          year, which is {(365 - days).toLocaleString()} days away. That&apos;s the
          same line the rooms draw, and it&apos;s here for the person on the other
          end of it: the people most likely to say yes to an offer like this are
          the ones with the least time.
        </p>
      )}

      {/* ⚠️ "Not interested" is a CHOSEN state and it displays on your
          page. Answering nothing displays nothing. Those two have to look
          different — silence you picked is not silence you never got
          round to. */}
      <button type="button" disabled={busy}
              className={'choice' + (spNA ? ' sel' : '')}
              aria-pressed={spNA}
              onClick={() => { const n = !spNA; setSpNA(n);
                if (n) { setHasSp('unsaid'); setWillSp('unsaid'); }
                save(n ? { sponsor_na: true, has_sponsor: 'unsaid', will_sponsor: 'unsaid' }
                       : { sponsor_na: false }, 'Saved.'); }}>
        <span className="ct">🤫 Not interested in any of this</span>
        <span className="cd">
          {spNA ? 'Shown on your page as a plain fact.'
                : 'Clears both answers above and says so on your page.'}
        </span>
      </button>
    </>
  );
}

/* ---------------------------------------------------------------------
   YOUR PATH
   ⚠️ The free-text box is ALWAYS shown, never gated behind picking a
   chip first. That is this afternoon's survey lesson: hiding it until
   somebody taps something locks out the one person whose entire answer
   is a thing we never thought of, which is the only answer that can
   teach us anything.
   --------------------------------------------------------------------- */
export function PathPicker({ paths, setPaths, pathOther, setPathOther, savedOther,
                             privatePaths, setPrivatePaths, save, busy, anon }) {
  const hidden = new Set(privatePaths || []);
  /* A group counts as hidden when every item in it is hidden. Membership
     lives here and ONLY here — the database stores the plain strings, so
     it never needs its own copy of this list to filter with. */
  const groupHidden = (g) => g.i.every((k) => hidden.has(k));
  return (
    <>
      <label>Your path</label>
      <p className="hint" style={{ marginTop: 0 }}>
        Tick everything that&apos;s part of it. All paths welcome &mdash; Suboxone included.
      </p>

      {PATH_GROUPS.map((g) => {
        const gh = groupHidden(g);
        const anyPicked = g.i.some((k) => paths.includes(k));
        return (
        <div key={g.n} className={'pgrp' + (gh ? ' pgrp-hid' : '')}>
          <span className="pgL">
            {g.e} {g.n}
            {/* ⚠️ The eye only appears once something in this group is
                ticked. An eye over an empty group is a control that
                changes nothing, which is the dead-switch this codebase
                keeps finding. */}
            {anyPicked && (
              <Eye on={!gh} busy={busy} what={g.n} anon={anon}
                   onToggle={() => setPrivatePaths((prev) => {
                     const set = new Set(prev || []);
                     if (gh) g.i.forEach((k) => set.delete(k));
                     else    g.i.forEach((k) => set.add(k));
                     const next = [...set];
                     save({ private_paths: next }, gh ? 'Shown.' : 'Hidden.');
                     return next;
                   })} />
            )}
          </span>
          <div className="pgW">
            {g.i.map((k) => {
              const on = paths.includes(k);
              return (
                <button key={k} type="button" disabled={busy}
                        className={'sbpill' + (on ? ' sel' : '')}
                        aria-pressed={on}
                        onClick={() => {
                          /* ⚠️ UPDATER FORM, and it is not style. Reading
                             `paths` here closes over the array as it was at
                             RENDER, so two taps landing inside one frame both
                             start from the same copy and the second wins.
                             Measured on the survey chips this afternoon:
                             thirteen fast taps left ONE chip lit. It fails
                             silently and in the direction of recording LESS
                             than the person said, which on a multi-select is
                             the worst way to be wrong. */
                          setPaths((prev) => {
                            const next = prev.includes(k)
                              ? prev.filter((x) => x !== k)
                              : [...prev, k];
                            /* 🔴 Tick something into a group you have
                               already hidden and it joins the hidden set
                               too. Without this, hiding Medication and
                               later adding Methadone would publish the
                               new one — the group would look hidden and
                               have a live item in it. */
                            if (gh && !prev.includes(k)) {
                              setPrivatePaths((pv) => {
                                const s2 = [...new Set([...(pv || []), k])];
                                save({ paths: next, private_paths: s2 }, 'Saved.');
                                return s2;
                              });
                            } else {
                              save({ paths: next }, 'Saved.');
                            }
                            return next;
                          });
                        }}>
                  {on ? '✓ ' : ''}{k}
                </button>
              );
            })}
          </div>
        </div>
        );
      })}

      <label htmlFor="pother">✍️ Something else</label>
      <input id="pother" type="text" maxLength={80} value={pathOther} disabled={busy}
             placeholder="Anything not on the list"
             onChange={(e) => setPathOther(e.target.value)} />
      {pathOther !== savedOther && (
        <button className="btn" type="button" disabled={busy}
                onClick={() => save({ path_other: pathOther.trim() || null }, 'Saved.')}>
          {busy ? 'Saving…' : 'Save that'}
        </button>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------
   THE THEMES
   🔴 A theme dresses the member's OWN page and nothing else. If colours
   travelled with their posts, an anonymous post would carry their
   fingerprint — somebody matches "the amethyst one" to a profile and the
   anonymity is gone. The wall stays green for everyone, and so does the
   nav: a page that looks different is a choice, navigation that looks
   different is a bug (the readings-page rule, 22 Aug).
   --------------------------------------------------------------------- */
export function ThemePicker({ theme, setTheme, save, busy }) {
  return (
    <>
      <div className="thWrap">
        {THEMES.map((t) => (
          <button key={t.k} type="button" disabled={busy}
                  className={'thChip' + (theme === t.k ? ' sel' : '')}
                  aria-pressed={theme === t.k}
                  onClick={() => { setTheme(t.k); save({ theme: t.k }, 'Saved.'); }}>
            <span className="thDot" style={{ background: t.dot }} aria-hidden="true" />
            {t.e} {t.n}
          </button>
        ))}
      </div>
      <p className="hint">
        Only your own page changes. The wall looks the same to everybody.
      </p>
    </>
  );
}

/* ---------------------------------------------------------------------
   WHO CAN SEE YOUR DAY COUNT

   🔴🔴 The worst "everything built except the way in" on this page.
   `day_count_visibility` has existed, been granted to members, and been
   read by can_see_day_count() in every profile query for weeks. There
   has never been a control. All 186 members are on 'everyone' — not one
   of them chose it, because choosing was impossible.

   🔴 [C] Building for Women.md calls a public day count the sharpest
   risk in the app: "predators filter for newcomers." A number saying how
   new you are, visible to anybody, with no way to turn it down, is that
   document's warning made real — and the switch was sitting there
   unwired the whole time.

   ⚠️ The default stays 'everyone'. Changing 186 people's setting
   underneath them would be its own kind of wrong. What they get is the
   choice, not a decision made on their behalf.
   --------------------------------------------------------------------- */
export function DayCountVisibility({ dcv, setDcv, save, busy }) {
  return (
    <>
      <label style={{ marginTop: 18 }}>Who can see your day count</label>
      <div className="sqBtns">
        {[['everyone', 'Everyone'], ['friends', 'Friends only'], ['nobody', 'Nobody']].map(([v, l]) => (
          <button key={v} type="button" disabled={busy}
                  className={'sbpill' + (dcv === v ? ' sel' : '')}
                  aria-pressed={dcv === v}
                  onClick={() => { setDcv(v); save({ day_count_visibility: v }, 'Saved.'); }}>
            {l}
          </button>
        ))}
      </div>
      <p className="hint">
        {dcv === 'everyone'
          ? 'Anyone who opens your page sees the number. Worth a thought if you’re new — a low day count tells a stranger exactly how new you are.'
          : dcv === 'friends'
            ? 'Only people you’re friends with see it. It still counts, and you still see it.'
            : 'Nobody sees it but you. Your page shows everything else as normal.'}
      </p>
    </>
  );
}

/* ---------------------------------------------------------------------
   YOUR HANDLE

   🔴🔴 A member could never change their own handle. The database has
   allowed it, and guarded it properly, since August: the handle guard
   fires on UPDATE as well as INSERT, reserved words are blocked, and a
   case-insensitive unique index stops you taking somebody else's. All of
   that was built. There was no box.

   🔴 WHY IT MATTERS MORE THAN ANYTHING ELSE ON THIS PAGE: somebody who
   signed up as their real name — and plenty did, because the box asks
   for a handle and a person types what they are called — had no way to
   undo it. In an app whose entire promise is that you never have to
   explain yourself, the one identity you could not take back was your
   own name.

   ⚠️ cleanHandle comes in as a prop and is the SAME function the sign-up
   box uses, so this field cannot hold a value the database will refuse.
   That is the 30 Aug lesson: eleven people had a login and no account
   because "Mary Jane" failed a CHECK they never saw, and the fix was not
   a better error message — it was a field that cannot hold the bad value.

   ⚠️ KNOWN, NOT FIXED HERE: a released handle becomes free for anybody,
   so an old /u/<name> link can later point at a stranger. Written down
   18 Aug. Fine at 186 members; must not reach 400 without a tombstone.
   --------------------------------------------------------------------- */
export function HandleEditor({ handle, setHandle, saved, clean, save, busy }) {
  const changed = handle !== saved;
  return (
    <>
      <label htmlFor="hnd">Your handle</label>
      <input id="hnd" type="text" maxLength={20} value={handle} disabled={busy}
             onChange={(e) => setHandle(clean(e.target.value))} />
      <p className="hint">
        Letters, numbers and underscores. It shows on your posts and it is the
        address of your page.
      </p>
      {changed && handle.length >= 3 && (
        <>
          <button className="btn" type="button" disabled={busy}
                  onClick={() => save({ handle }, 'Saved. That’s you now.')}>
            {busy ? 'Saving…' : 'Change my handle'}
          </button>
          <p className="hint">
            ⚠️ Your old link stops working, and the old name becomes free for
            somebody else to take. Worth telling the people who know you by it.
          </p>
        </>
      )}
      {changed && handle.length > 0 && handle.length < 3 && (
        <p className="hint">Three characters or more.</p>
      )}
    </>
  );
}
