import { READINGS } from './texts';

/* =====================================================================
   WHICH READING IS TODAY'S.  26 Sept 2026.

   ⭐ THE SAME ONE FOR EVERY MEMBER. Ty picked that over a per-member
   rotation, and the reason is the only reason that matters here: a
   member can say "that thing about the stone they put under Moses" on
   the wall and 387 other people know exactly what they mean. A personal
   rotation makes every reading a private event nobody else is having.

   🔴 THIS IS DELIBERATELY NOT HOW wyr_today() WORKS, AND THAT IS THE
   WHOLE POINT OF THE FILE.

   Would You Rather picks the newest prompt with released_on <= today.
   On 30 Sept 2026 it runs out of rows and then serves the same question
   every day forever, silently, with nothing in the logs. A modulo
   cannot do that. There is no last entry and no schedule to exhaust —
   add a 131st reading and the cycle is 131 days long.

   ⚠️ THE DAY BOUNDARY IS NEW YORK'S, NOT THE DEVICE'S. If it were the
   device's, a member in California would flip to tomorrow's reading at
   9pm while Ohio was still on today's, and "today's reading" would stop
   meaning one thing. The cost is real and accepted: somebody on the
   west coast gets the new one at 9pm their time.

   ⚠️ Intl with timeZone is doing the work rather than a hand-rolled UTC
   offset, because America/New_York is -4 for part of the year and -5
   for the rest. A fixed offset is correct for eight months and wrong
   for four, which is the kind of bug that shows up in November and
   nobody connects to a line written in September.

   ⚠️ THE EPOCH IS ARBITRARY AND MUST NEVER CHANGE. Moving it reshuffles
   which reading lands on which day for everybody at once. It is only
   here so the day number is a small integer rather than 20,000.
   ===================================================================== */

const EPOCH_UTC = Date.UTC(2026, 0, 1);   /* 1 Jan 2026 — do not change */
const MS_PER_DAY = 86400000;

/* The calendar date in New York, as a day number. */
export function dayNumber(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).split('-');

  const midnightNY = Date.UTC(
    Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])
  );
  return Math.round((midnightNY - EPOCH_UTC) / MS_PER_DAY);
}

/* ⚠️ The double modulo is not superstition. A negative day number — any
   date before the epoch, which a device with a wrong clock can produce —
   makes % return a negative index in JavaScript, and READINGS[-3] is
   undefined, which renders as a blank page rather than an error. */
export function readingForDay(n) {
  const len = READINGS.length;
  return READINGS[((n % len) + len) % len];
}

export function readingForToday(now = new Date()) {
  return readingForDay(dayNumber(now));
}

/* Light rows for the library list — id, and the four things the list
   shows. ⚠️ The full text is NOT in here on purpose: 130 passages is
   about 120KB, and shipping all of it to every phone to render a list
   of titles would be the whole library in the bundle for nothing. The
   passage is fetched by its own route when somebody opens it. */
export function libraryIndex() {
  return READINGS.map((r) => ({
    id: r.id, mark: r.mark, ref: r.ref, title: r.title, who: r.who,
  }));
}

export function readingById(id) {
  return READINGS.find((r) => r.id === id) || null;
}
