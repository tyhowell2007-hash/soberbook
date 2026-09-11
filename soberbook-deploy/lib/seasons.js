/* =====================================================================
   SEASONS — reading the room's weather.

   ⚠️ NO 'use client' DIRECTIVE, ON PURPOSE. Next turns every export of a
   client module into a client REFERENCE, so a server component importing
   a named export out of one gets a proxy instead of a function — that
   took /wall down for every member on 2 Sept with a green build. A plain
   lib module is importable from either side. Same shape as previews.js,
   drops.js and open-room.js, and for the same reason.

   🔴 THE "NEVER A 1" RULE IS NOT IN HERE. It lives in season_counts() in
   the database, which returns NULL instead of a number below three. That
   is deliberate: a rule enforced at the source cannot be forgotten by a
   second screen written later. This file cannot print a 1 because it is
   never handed one.
   ===================================================================== */

export async function fetchSeasons(supabase) {
  const [{ data: counts }, { data: moved }] = await Promise.all([
    supabase.rpc('season_counts'),
    supabase.rpc('season_movement', { days: 30 }),
  ]);
  return { counts: counts || [], moved: moved || [] };
}

/* How many people are in the room's seasons altogether. ⚠️ Sums only the
   numbers we were GIVEN, so seasons with one or two people are absent
   from the total rather than quietly re-revealed by arithmetic — you
   cannot subtract your way back to "there is one person in that one". */
export function totalPlaced(counts = []) {
  return counts.reduce((n, c) => n + (c.n || 0), 0);
}

/* The line under a season's name. 🔴 Three states, and the middle one is
   the whole reason this function exists: a count of one, printed, tells
   the only person in a season that they are alone — which is the exact
   opposite of why Ty asked for this feature. Below three we say "a
   couple of others" and mean it. */
export function peopleLine(c) {
  if (c.n) return `${c.n} people`;
  if (c.few) return 'you and a couple of others';
  return 'nobody yet';
}

/* ⚠️ Movement is the MESSAGE, not a statistic. "Season" means temporary,
   and this is the only evidence on the page that the word is true. Rows
   with nothing in them are dropped rather than shown as zeroes. */
export function movementLines(moved = []) {
  return (moved || [])
    .filter((m) => (m.left_n || 0) > 0 || (m.joined_n || 0) > 0)
    .map((m) => ({
      slug: m.slug,
      emoji: m.emoji,
      label: m.label,
      left: m.left_n || 0,
      joined: m.joined_n || 0,
    }));
}
