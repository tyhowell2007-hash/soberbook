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

export default function MilestoneCard({ days }) {
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

        <p className="msfine">
          Everybody here gets the same medal — day one or six years.
          That&apos;s on purpose.
        </p>
      </div>
    </div>
  );
}
