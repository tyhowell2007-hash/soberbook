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
