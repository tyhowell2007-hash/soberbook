/* =====================================================================
   RECOVERY COINS — the one list.  31 Oct 2026 (0195).

   Ty: "Instead of likes, we do coins, like recovery coins." Four coins
   replace Support and Strength on every post.

   ⭐ THE DATABASE WORDS NEVER CHANGED. `support` is drawn as "I see you"
   and `strength` as "Keep going" — Ty's mapping, one to one — so the
   1,241 reactions sent before coins existed are coins now without a
   single row being rewritten. Only `proud` and `metoo` are new.

   ⚠️ No 'use client': the server profile pages and the browser wall both
   read this file (the 2 Sept lesson — a shared helper belongs to neither
   runtime).

   🔴 COINS ARE FREE. Nothing in this app buys, sells or cashes them out,
   and nothing ever should. That is the line between a recovery coin and
   a slot machine.
   ===================================================================== */

export const COINS = [
  { kind: 'support',  name: 'I see you',    metal: 'bronze', picture: 'Hands around a flame' },
  { kind: 'strength', name: 'Keep going',   metal: 'silver', picture: 'A trail up the hill' },
  { kind: 'proud',    name: 'Proud of you', metal: 'gold',   picture: 'The Sober Book sunrise' },
  { kind: 'metoo',    name: 'Me too',       metal: 'green',  picture: 'Two rings, linked' },
];

export const COIN = Object.fromEntries(COINS.map((c) => [c.kind, c]));
export const COIN_KINDS = COINS.map((c) => c.kind);
export const NOTE_MAX = 80;

export function isCoin(kind) {
  return COIN_KINDS.includes(kind);
}

/* Counts straight off a feed_posts row. proud/metoo arrive undefined on a
   row fetched before 0195 ran, so every read is defaulted to 0 — a page
   that loads before the SQL is pasted shows the old coins, not NaN. */
export function coinCounts(p) {
  return {
    support:  Number(p?.support_count)  || 0,
    strength: Number(p?.strength_count) || 0,
    proud:    Number(p?.proud_count)    || 0,
    metoo:    Number(p?.metoo_count)    || 0,
  };
}

export function coinTotal(p) {
  if (p && p.coin_count != null) return Number(p.coin_count) || 0;
  const c = coinCounts(p);
  return c.support + c.strength + c.proud + c.metoo;
}

/* The kinds this post has received, most first — for the little stack. */
export function topKinds(p, n = 3) {
  const c = coinCounts(p);
  return COIN_KINDS.filter((k) => c[k] > 0)
    .sort((a, b) => c[b] - c[a])
    .slice(0, n);
}

/* The coin I sent. my_coin comes from 0195; before it, fall back to the
   two old flags so a stale row still lights the right button. */
export function myCoin(p) {
  if (!p) return null;
  if (p.my_coin) return p.my_coin;
  if (p.supported_by_me) return 'support';
  if (p.strengthed_by_me) return 'strength';
  return null;
}

/* Optimistic update for a feed_posts row: my coin moves from `was` to
   `now` (either may be null). Mirrors send_coin()/take_back_coin(). */
export function applyCoin(p, was, now) {
  if (was === now) return p;
  const key = (k) => `${k}_count`;
  const next = { ...p };
  if (was) next[key(was)] = Math.max(0, (Number(p[key(was)]) || 0) - 1);
  if (now) next[key(now)] = (Number(p[key(now)]) || 0) + 1;
  const delta = (now ? 1 : 0) - (was ? 1 : 0);
  next.coin_count = Math.max(0, coinTotal(p) + delta);
  next.my_coin = now;
  next.supported_by_me = now === 'support';
  next.strengthed_by_me = now === 'strength';
  return next;
}
