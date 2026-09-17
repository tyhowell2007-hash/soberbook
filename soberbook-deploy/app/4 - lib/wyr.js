/* =====================================================================
   🎲 WOULD YOU RATHER — the reading half.

   ⚠️ NO 'use client' DIRECTIVE. Every export of a client module becomes a
   client REFERENCE, so a server component importing a named export out of
   one gets a proxy instead of a function — that took /wall down for every
   member on 2 Sept with a green build. Same shape as circles.js,
   previews.js, drops.js, open-room.js and seasons.js, for the same reason.

   ⭐ THE COPY LIVES HERE, NOT IN THE COMPONENT. One predicate, one caller
   today and probably a Home card tomorrow — the 0046 → 0049 drift is what
   happens when the card and the room each write their own sentence about
   the same numbers.
   ===================================================================== */

export async function fetchWyr(supabase) {
  const { data, error } = await supabase.rpc('wyr_today');
  if (error) return null;
  return (data || [])[0] || null;
}

/* Returns true only when the vote actually landed. 🔴 The caller must NOT
   paint the result optimistically — see the note in the component. */
export async function castWyr(supabase, promptId, pick) {
  const { error } = await supabase.rpc('vote_wyr', { p: promptId, pick });
  return !error;
}

/* ⚠️ The two percentages are forced to add to 100. Rounding each one
   independently prints "62% / 39%" often enough that somebody screenshots
   it, and a poll that cannot add up is a poll nobody believes. */
export function share(a, b) {
  const t = (a || 0) + (b || 0);
  if (!t) return [0, 0];
  const pa = Math.round(((a || 0) / t) * 100);
  return [pa, 100 - pa];
}

/* The one sentence under the bars. It is the whole point of the feature:
   the number is not the payoff, the number is the thing worth arguing
   with in the room below it.

   🔴 NEVER "you were wrong" OR "you were in the minority". There is no
   right answer to a would-you-rather, and this app does not have a
   surface that tells a member their answer was the unpopular one.
   ⚠️ Counts, never names — who voted which way is not returned by
   wyr_today() at all, so this cannot leak it even by accident. */
export function afterLine(q) {
  if (!q || !q.my_choice) return '';

  const mineA = q.my_choice === 'a';

  /* Under three voters the server withholds the circle split, so the only
     honest thing to talk about is the whole app. See 0164 rule 2. */
  if (q.circle_a === null || q.circle_a === undefined) {
    const [pa, pb] = share(q.all_a, q.all_b);
    if (!pa && !pb) return 'You’re the first one here to answer this.';
    return `Your circle is still answering. Across Sober Book it’s ${pa} to ${pb}.`;
  }

  const mine   = mineA ? q.circle_a : q.circle_b;
  const theirs = mineA ? q.circle_b : q.circle_a;

  if (mine === theirs) return 'Your circle is split straight down the middle.';
  if (theirs > mine) {
    return theirs === 1
      ? 'One person in your circle went the other way.'
      : `${theirs} of them went the other way.`;
  }
  return theirs === 0
    ? 'Everybody in your circle who’s answered picked the same one you did.'
    : 'Most of your circle picked the same one you did.';
}
