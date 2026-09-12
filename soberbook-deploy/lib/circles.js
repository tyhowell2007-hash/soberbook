/* =====================================================================
   ⭕ CIRCLES — the people who walked in the same week.

   ⚠️ NO 'use client' DIRECTIVE. Every export of a client module becomes a
   client REFERENCE, so a server component importing a named export out of
   one gets a proxy instead of a function — that took /wall down for every
   member on 2 Sept with a green build. Same shape as previews.js,
   drops.js, open-room.js and seasons.js, and for the same reason.
   ===================================================================== */

export async function fetchCircle(supabase) {
  const [{ data: mine }, { data: wall }] = await Promise.all([
    supabase.rpc('my_circle'),
    supabase.rpc('circle_wall', { lim: 60 }),
  ]);
  return { circle: (mine || [])[0] || null, messages: (wall || []).slice().reverse() };
}

/* How the room describes itself. 🔴 NEVER "1 person" and never a zero —
   you are always in your own circle, so a count of one means everybody
   else is gone, and printing that is the cruellest possible way to open
   a screen built to make somebody feel less alone. Same rule as the
   open-room card and the season counts. */
export function whoLine(c) {
  if (!c) return '';
  const n = c.people || 0;
  if (n <= 1) return 'your circle is still forming';
  if (n === 2) return 'two of you started the same week';
  return `${n} of you started the same week`;
}

/* ⚠️ Deliberately NOT "4 of 9 are still here" — that phrasing counts the
   people who left, in front of the people who stayed. The number that
   helps is how many spoke recently, because that is who might answer. */
export function aliveLine(c) {
  if (!c) return '';

  /* 🔴 A ROOM THAT NEVER STARTED IS NOT A ROOM THAT WENT QUIET, AND
     spoke_this_week CANNOT TELL THEM APART — it is 0 for both.

     On the day circles ship, all 29 of them have carried exactly zero
     messages. Without this branch every member opens Home to "nobody has
     said anything this week" — a sentence that describes people going
     silent, printed over a room where nothing has happened yet. Nobody
     is missing. It has not begun.

     ⭐ Same rule as the open-room card, which refuses to print a zero
     because broadcasting "nobody is here" to every home screen is how you
     tell a whole room the place is dead. This one is worse if you get it
     wrong, because a sentence reads as a judgement where a digit reads as
     a count.

     ⚠️ `ever_spoke` comes from my_circle() (0154) as an EXISTS, never a
     count — the screen only needs to know whether the room has begun, and
     "3 messages ever" on a card is a scoreboard.

     ⚠️ This function is the ONE place the state is put into words, and
     both the Home card and the room read it. Restating the branch in
     either component is the 0046 → 0049 drift: the card would eventually
     say one thing while the room said another about the same circle. */
  if (!c.ever_spoke) return 'you could be the first to say something';

  const s = c.spoke_this_week || 0;
  if (s === 0) return 'nobody has said anything this week';
  if (s === 1) return 'one of you has spoken this week';
  return `${s} of you have spoken this week`;
}

/* The week they arrived, written the way a person says it. */
export function weekLine(c) {
  if (!c || !c.cohort_week) return '';
  const d = new Date(c.cohort_week + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}
