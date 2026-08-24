/* =====================================================================
   Chips, and how far you are from the next one.

   Two different kinds of milestone live in here, and they are NOT
   measured the same way. That distinction is the whole file.

     30 · 60 · 90 · 6 months   are counted in DAYS.
     1 year · 2 years · 3 …    are counted in DATES.

   WHY NOT JUST USE 365 × n AND BE DONE
   ------------------------------------
   Because a year is not 365 days. Somebody sober since 1 March 2024
   hits three years on 1 March 2027 — and between those dates sits
   2028's leap day... except it doesn't, so they'd be fine; but somebody
   sober since 2023 crosses 29 Feb 2024, and 365 × 3 puts their "3-year
   chip" on 28 February. One day early.

   Nobody would file that as a bug. They'd just notice the app said
   they'd made it the day before they had, on the one date of the year
   they actually care about, and quietly trust it less. Anniversaries
   are calendar events. Counting them in days is the kind of shortcut
   that is right about 3 times in 4.

   So the year chips are computed by adding N to the year of the sober
   date and asking the calendar what that means.

   ⚠️ 29 FEBRUARY: Date.UTC(2025, 1, 29) does not throw — it rolls
   forward to 1 March. Someone sober since a leap day gets their chip on
   1 March in common years, which is the same answer most people give
   when you ask them, and is at least a real date.

   ⚠️ EVERYTHING IN HERE IS UTC ON PURPOSE. `new Date('2026-08-09')` is
   parsed as midnight UTC, which in Ohio is the evening of the 8th. Mix
   that with a local-time "today" and the day count is off by one for
   several hours every evening — a bug that shows up after dinner and
   never in the morning. So both sides of every subtraction are UTC.
   ===================================================================== */

/* The day-counted ones. Kept short deliberately: these are the early
   marks, where a week feels like a month and a chip needs to be close
   enough to see. */
const DAY_MARKS = [
  { days: 30,  label: '30',   full: '30 days' },
  { days: 60,  label: '60',   full: '60 days' },
  { days: 90,  label: '90',   full: '90 days' },
  { days: 180, label: '6 mo', full: '6 months' },
];

const MAX_YEAR = 50;

function utcMidnight(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 'YYYY-MM-DD' -> UTC ms at midnight. Split by hand rather than handing
 *  the string to Date(), so the parse can't be reinterpreted by locale. */
function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/** Whole days between two UTC midnights. Both operands are already
 *  normalised, so this is exact — no rounding, no DST to trip over. */
function daysBetween(aMs, bMs) {
  return Math.round((bMs - aMs) / 86400000);
}

/* HOW MANY DAYS. The only place in the app that answers this.

   ⚠️ Aug 24: three other files were computing this by hand and none of
   them clamped, so a member with a sober date in the future was published
   as "day -130". The rule is written here and called from there now —
   the 0046 -> 0049 lesson, which is that a rule RESTATED somewhere else
   is a second implementation, and the second one drifts.

   🔴 A DATE THAT HASN'T HAPPENED RETURNS null, NOT 0.

   This used to be Math.max(0, ...), which is wrong in a quiet way. "Day
   0" is not a neutral placeholder — it is a specific claim that somebody
   started today. null already means "no answer" everywhere in this app
   (it is what a member who never set a date returns), so a person who
   hasn't started yet is indistinguishable from a person who didn't
   share. That is deliberate: see 0064. */
export function dayCount(sinceISO, now = new Date()) {
  const start = parseISO(sinceISO);
  if (start === null) return null;
  const n = daysBetween(start, utcMidnight(now));
  return n < 0 ? null : n;
}

/** Days until a future sober date, or null if it has already arrived.
 *
 *  ⚠️ FOR THE MEMBER'S OWN PAGE ONLY. Never send this to anybody else: a
 *  public countdown doesn't read as "planning something", it reads as
 *  *this person is using right now and here is the date they mean to
 *  stop* — a newcomer flag with a clock on it. Same reason there are no
 *  presence dots. */
export function startsInDays(sinceISO, now = new Date()) {
  const start = parseISO(sinceISO);
  if (start === null) return null;
  const n = daysBetween(utcMidnight(now), start);
  return n > 0 ? n : null;
}

/** Builds every milestone for this person: the four day marks, then a
 *  year chip for each anniversary the calendar actually produces. */
export function milestones(sinceISO, now = new Date()) {
  const start = parseISO(sinceISO);
  if (start === null) return [];
  const today = utcMidnight(now);
  const [y, m, d] = String(sinceISO).split('-').map(Number);

  const out = DAY_MARKS.map((mk) => ({
    key: 'd' + mk.days,
    label: mk.label,
    full: mk.full,
    at: start + mk.days * 86400000,
  }));

  for (let n = 1; n <= MAX_YEAR; n++) {
    out.push({
      key: 'y' + n,
      label: n + ' yr',
      full: n === 1 ? '1 year' : n + ' years',
      at: Date.UTC(y + n, m - 1, d),
    });
  }

  return out.map((mk) => ({
    ...mk,
    earned: mk.at <= today,
    daysAway: daysBetween(today, mk.at),
  }));
}

/* What to show under the number.

   Returns the next unearned chip, the one before it, and how far along
   the gap is — so the bar measures THIS stretch rather than the whole
   of someone's sobriety. A bar that ran from day zero would sit at 97%
   forever for anyone with real time, which tells them nothing and
   flatters them slightly. Between two chips, the bar moves visibly in a
   week. */
export function progress(sinceISO, now = new Date()) {
  const all = milestones(sinceISO, now);
  if (!all.length) return null;

  const next = all.find((mk) => !mk.earned);
  const earned = all.filter((mk) => mk.earned);
  const last = earned.length ? earned[earned.length - 1] : null;

  /* Fifty years in. Nothing left to count toward, and inventing a chip
     would be worse than admitting the list ran out. */
  if (!next) return { next: null, last, pct: 100, all };

  const from = last ? last.at : parseISO(sinceISO);
  const span = next.at - from;
  const done = utcMidnight(now) - from;

  return {
    next,
    last,
    pct: span > 0 ? Math.max(0, Math.min(100, (done / span) * 100)) : 0,
    all,
  };
}

/* =====================================================================
   Turn a day count back into the date it came from.

   public_profiles hands out `day_count` and deliberately withholds
   `sober_since` — 0008 says, in as many words, "it has no sober date,
   only a count." The chips need a calendar date to land year
   anniversaries correctly, so this reconstructs one.

   ⚠️ AND THAT SHOULD BOTHER YOU FOR A SECOND, SO LET'S BE STRAIGHT
   ABOUT IT: day_count is `current_date - sober_since`. Anyone holding
   the count and a calendar has the date. This function is four lines
   long because there was never anything to undo.

   So 0008's claim is weaker than it reads. Withholding the date while
   publishing the count is not a privacy control — it is the same fact
   in different units. It is not a LEAK either: the count was always
   meant to be public, and the date adds nothing on top of it. But a
   comment that says "this page cannot know your date" is wrong, and a
   wrong comment about privacy is worse than no comment, because the
   next person builds on it.

   The real protections on that view are the ones that actually remove
   information: no profile id, no privacy_mode, and everything nulled in
   anonymous mode. Those hold. This one never did.
   ===================================================================== */
export function sinceFromCount(count, now = new Date()) {
  if (count === null || count === undefined) return null;
  const ms = utcMidnight(now) - Number(count) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/* IS TODAY A MILESTONE?

   Returns the mark landing exactly today, or null. Used by the Wall to
   decide whether to offer the celebration card.

   ⚠️ daysAway === 0 and NOT "earned today or recently". The difference
   matters: a looser test would greet somebody with "you hit 90 days!"
   three days late, or worse, every day until they answered. This fires
   on the day or not at all.

   ⚠️ It also means a milestone that lands while somebody isn't looking is
   simply missed, and that is the right trade. The alternative — holding
   an unshown celebration and springing it later — means opening the app
   after a hard week and being congratulated for a number that is no
   longer true. Nothing here should ever tell somebody about their own
   count on a delay.

   Returns at most one mark. Two marks cannot share a date: the day marks
   are 30/60/90/180 and the year marks are calendar anniversaries, and a
   30-day and a 1-year cannot both be today unless someone's sober date is
   in the future.

   ⚠️ AN EARLIER VERSION OF THIS COMMENT SAID "which parseISO already
   refuses". It does not, and never did — parseISO splits a string into
   three numbers and returns them. A live member had a sober date of
   2027-01-01 for five days while that sentence sat here claiming it was
   impossible. Corrected Aug 24. A wrong comment about a safety property
   is worse than no comment, because the next person builds on it — which
   is the same thing this file already says forty lines up about
   sinceFromCount. Twice now. */
export function milestoneToday(sinceISO, now = new Date()) {
  const all = milestones(sinceISO, now);
  return all.find((mk) => mk.daysAway === 0) || null;
}

/* The chip row is capped so it stays one line on a phone: everything
   earned, plus the one being worked toward. Someone at 4,000 days does
   not need thirty grey circles trailing off the screen. */
export function chipRow(sinceISO, now = new Date(), tail = 7) {
  const p = progress(sinceISO, now);
  if (!p) return [];
  const shown = p.all.filter((mk) => mk.earned || mk.key === p.next?.key);
  return shown.slice(-tail);
}
