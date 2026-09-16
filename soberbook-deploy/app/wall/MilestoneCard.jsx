/* ============================================================================
   🏅 THE MILESTONE CELEBRATION CARD.

   Ty, 11 Sept, in four goes because I kept drawing the tasteful version:
   "Put metals on there too because it's a big achievement to get to a
   milestone." · "This has to be a celebration to the highest form." · "make
   the years in gold color." · "add confetti in there as well. This is a big
   celebration." Then, on the mockup: "perfect."

   WHAT THIS REPLACES. A milestone post used to render a 28px grey strip that
   said "1096-day chip" — a sentence nobody in a room has ever said out loud,
   under a post somebody had to be ASKED before they'd share. The consent
   flow was built, the gold was styled, and what came out the other end was a
   receipt. This is the other end now.

   ⚠️ NO 'use client' AND NO HOOKS, ON PURPOSE. It renders exactly what it is
   handed. Wall.jsx is already a client module, so this inherits that for
   free — and if a server surface ever wants to render a milestone (a post's
   own page at /p/[id], say) this can go there untouched. The moment it grows
   a hook that stops being true.

   🔴 IT NEVER COMPUTES A LABEL. `markLabel`/`markParts` in lib/milestones.js
   own the answer to "what do we call 1,096 days", and the small badge in the
   post header calls the same function. Two places on one screen disagreeing
   about somebody's milestone is the 0046 → 0049 drift, and this is the worst
   possible screen for it to happen on.

   ⚠️ IT CANNOT DECIDE WHETHER TO SHOW ITSELF. `milestone_days` is only ever
   set by a deliberate tap (0015 — the app asks first and takes no for an
   answer), so the presence of the number IS the consent. Nothing here looks
   at a date, and nothing here should ever start to: an app that notices your
   anniversary and announces it has reversed a decision made a year ago.
   ============================================================================ */

import { markParts } from '../../lib/milestones';

/* THE CONFETTI, WRITTEN OUT RATHER THAN RANDOMISED.

   🔴 Math.random() would re-roll on every re-render — and this card sits in a
   feed that re-renders on every heart, every reply preview refresh and every
   poll. The pieces would jump to new columns mid-fall while somebody was
   looking at them. Fourteen fixed values are also, bluntly, easier to tune
   than a seed.

   ⚠️ The two golds and the two greens are VARIABLES, so the confetti flips
   with the rest of the card at 2am. A literal gold here would be the only
   thing on a black screen still glowing amber.

   ⚠️ Deliberately uneven left values and delays. Evenly spaced confetti reads
   as a loading bar. */
const BITS = [
  { l: '4%',  d: '0s',    t: '3.6s', c: 'var(--gold-ring)', r: 'round' },
  { l: '11%', d: '1.4s',  t: '4.2s', c: 'var(--gd)',        r: '' },
  { l: '19%', d: '0.5s',  t: '3.2s', c: 'var(--gold-ink)',  r: '' },
  { l: '26%', d: '2.2s',  t: '4.6s', c: 'var(--gold-ring)', r: 'round' },
  { l: '34%', d: '0.9s',  t: '3.9s', c: 'var(--gm-t)',      r: '' },
  { l: '42%', d: '2.8s',  t: '3.4s', c: 'var(--gold-ring)', r: '' },
  { l: '49%', d: '0.2s',  t: '4.4s', c: 'var(--gd)',        r: 'round' },
  { l: '57%', d: '1.8s',  t: '3.1s', c: 'var(--gold-ring)', r: '' },
  { l: '64%', d: '3.1s',  t: '4.0s', c: 'var(--gold-ink)',  r: 'round' },
  { l: '72%', d: '0.7s',  t: '3.7s', c: 'var(--gm-t)',      r: '' },
  { l: '79%', d: '2.5s',  t: '4.3s', c: 'var(--gold-ring)', r: '' },
  { l: '86%', d: '1.1s',  t: '3.3s', c: 'var(--gd)',        r: 'round' },
  { l: '92%', d: '3.4s',  t: '4.1s', c: 'var(--gold-ring)', r: '' },
  { l: '97%', d: '1.6s',  t: '3.8s', c: 'var(--gold-ink)',  r: '' },
];

/* 🎉 `name` AND `face` ADDED 16 SEPT. Ty: "I want this to come up automatically
   every time somebody is celebrating a milestone in their life. I don't want to
   be the one presenting it. It comes up by itself."

   ⭐ WHAT CHANGED IS WHO THE CARD IS FOR. It used to sit under its own author's
   name in the post header, so the card itself never needed to say who — the
   header had already said it two lines up. Now the card floats to the TOP of
   everybody's wall (see pickCelebrations in lib/mix.js), and at the top of a
   feed a medal with no name on it is a medal belonging to nobody.

   ⚠️ BOTH ARE OPTIONAL AND THE CARD RENDERS WITHOUT THEM. It is still mounted
   inside a post on /p/[id] and in the reply sheet, where the header is right
   there and repeating the name would be noise. Passing nothing is a supported
   state, not a bug to defend against.

   🔴 THERE IS NO CONSENT DECISION IN THIS FILE AND THERE MUST NOT BE ONE.
   `milestone_days` is only ever written by a deliberate tap (0015 — the app
   asks first and takes no for an answer), so the presence of the number IS the
   permission, exactly as it was before. Ty was shown the version that announces
   every milestone without asking and chose to keep the ask: a public day count
   is what `[C] Building for Women.md` calls the sharpest risk in the app, and
   "somebody — 30 days" broadcast to 316 people is that signal precisely. */
export default function MilestoneCard({ days, name, face }) {
  const parts = markParts(days);

  /* A milestone we cannot name is not a milestone we celebrate quietly with a
     blank medal — it is nothing at all. markParts only returns null for a
     value that should never have reached the column (zero, negative, junk),
     and a card reading "  " in 36px gold would be far louder than the bug. */
  if (!parts) return null;

  return (
    <div className="mscard">
      {/* aria-hidden on every piece: a screen reader announcing fourteen
          empty divs in the middle of somebody's celebration is the opposite
          of the point. Nothing here carries meaning the words below don't. */}
      {BITS.map((b, i) => (
        <span
          key={i}
          className={'msbit' + (b.r ? ' round' : '')}
          aria-hidden="true"
          style={{
            left: b.l,
            background: b.c,
            animationDelay: b.d,
            animationDuration: b.t,
          }}
        />
      ))}

      <div className="msinner">
        <div className="mseyebrow">
          <span className="msrule" aria-hidden="true" />
          <span>MILESTONE</span>
          <span className="msrule" aria-hidden="true" />
        </div>

        {/* 🎉 WHOSE DAY IT IS — above the medal, never below it.

            ⚠️ THE ORDER IS THE POINT. Name first, then the number. The other
            way round the card announces a quantity and then discloses who it
            belongs to, which is how a leaderboard reads. This reads like
            somebody being introduced.

            ⚠️ The face is whatever the feed already resolved — the emoji, or
            the default 🌱. It is NOT the photo avatar: a signed photo URL
            expires in an hour and this card is the first thing on the wall,
            so a dead image would be the first thing anybody sees. The emoji
            never expires. (See the 5 Sept expiry bug.)

            ⚠️ aria-hidden on the face, and the NAME carries the meaning — a
            screen reader saying "seedling Kenny K" is worse than "Kenny K". */}
        {name ? (
          <div className="mswho">
            <span className="pa" aria-hidden="true">{face || '🌱'}</span>
            <b>{name}</b>
          </div>
        ) : null}

        {/* THE MEDAL. Same gold, same 116px, day one to six years — the
            engraving is the only thing that changes. See milestone.css for
            why there are no tiers. */}
        <div className="msmedal">
          <span className="msnum">{parts.num}</span>
          <span className="msunit">{parts.unit}</span>
        </div>

        {/* ⚠️ THE NUMBER IS SAID TWICE, ON PURPOSE. The medal engraves it and
            the headline shouts it. That is not an oversight to be tidied —
            "a celebration to the highest form" was the instruction, and a
            real one repeats itself. */}
        <p className="mshead">{parts.num} {parts.unit}.</p>

        {/* 🎉 THE CONGRATULATION, 16 Sept. Ty: "just put congratulations to
            Kenny Kearns on six years of sobriety."

            ⚠️ IT ONLY APPEARS WITH A NAME, and that is the same condition as
            the face row above. With no name this card is mounted inside a
            post whose header already says who — congratulating somebody two
            lines under their own byline reads like the app talking to itself.

            ⚠️ IT SAYS WHAT THE DM SAYS. `milestone_words()` in 0161 sends
            "Congrats on 6 years of sobriety!!!" as a private message on the
            day; this is the public half of the same sentence, so a member who
            gets both does not get two different framings of their own
            milestone eight hours apart.

            🔴 THE NAME IS WHATEVER THE FEED RESOLVED — the member's own
            display name, never a real name we hold elsewhere. Ty asked for
            "Kenny Kearns" and was shown the cost: a surname is not in this
            app anywhere a member put it, and publishing one to 316 people
            alongside the fact somebody is in recovery is a disclosure they
            did not make. He chose the display name. Do not "improve" this by
            reaching for a fuller name from any other source. */}
        {name ? (
          <p className="mscongrats">
            Congratulations to {name} on{' '}
            {[parts.num, parts.unit].filter(Boolean).join(' ')} of sobriety.
          </p>
        ) : null}

        <p className="msfine">
          Everybody here gets the same medal — day one or six years.
          That&apos;s on purpose.
        </p>

        {/* 🔴 STOP THE CONFETTI — Ty, 16 Sept: "loop it until he stops it."

            ⭐ IT IS A CHECKBOX AND A CSS RULE, NOT A HOOK, AND THAT IS THE
            WHOLE REASON IT CAN EXIST HERE. This file has no 'use client' and
            no state on purpose, so it can also render on /p/[id] as a server
            component — the header at the top of this file says so, and says
            that the moment it grows a hook that stops being true. A label
            wrapping its own input needs no id (so three cards on one wall
            cannot collide), and `.mscard:has(.msstopbox:checked)` freezes
            that card's pieces and nobody else's.

            ⚠️ IT IS NOT THE SAME THING AS prefers-reduced-motion, which is
            already handled in milestone.css and is a standing instruction
            from the device. This is for the person who simply wants it to
            stop — and on a card that loops forever at the top of the wall,
            not offering that is how a celebration turns into a nuisance. */}
        <label className="msstop">
          <input type="checkbox" className="msstopbox" />
          <span>stop the confetti</span>
        </label>
      </div>
    </div>
  );
}
