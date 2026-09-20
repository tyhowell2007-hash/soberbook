/* =====================================================================
   THE LOOK — the sets a member picks their page from. 20 Sept.

   🔴 THIS FILE IS PLAIN, AND THAT IS THE WHOLE REASON IT EXISTS. The
   covers, the colours and the section list are needed by BOTH the picker
   (a 'use client' component) and /u/[handle] (a server component). A
   server file importing a NAMED export from a 'use client' module is the
   bug that took the wall down for every member on 2 Sept with a green
   build. So the shared parts live here, in a file with no 'use client'
   line, and both sides import from it.

   ⚠️ THE DATABASE HAS THE SAME LISTS AS CHECK CONSTRAINTS (0182). If you
   add a cover or a colour here, add it there in the same commit, or the
   member gets a control that saves nothing.
   ===================================================================== */

export const COVERS = [
  { k: 'none',    n: 'None',        css: 'none' },
  { k: 'meadow',  n: 'Meadow',      css: 'linear-gradient(135deg,#2F7A48,#6DB36A 55%,#D9CF6A)' },
  { k: 'water',   n: 'Still water', css: 'linear-gradient(135deg,#123A5C,#2E6E9E 60%,#7FB4D6)' },
  { k: 'sunrise', n: 'Sunrise',     css: 'linear-gradient(135deg,#7A2E1E,#C4683A 60%,#E8B06A)' },
  { k: 'night',   n: 'Night',       css: 'linear-gradient(135deg,#2B2140,#584A82 60%,#9B8FC7)' },
  { k: 'paper',   n: 'Old paper',   css: 'linear-gradient(135deg,#3F3A33,#7A6F5E 60%,#C6B79B)' },
];

/* MEASURED, each as text on the profile card (#FFFFFF light / #18211C in
   Night) and as the rule under a heading (non-text, needs ≥3):
     green  #2F6B4A  7.11 / 4.62     blue   #1F5C8B  6.98 / 4.71
     clay   #8A2B2B  8.06 / 4.09     gold   #7A5500  6.29 / 5.24
     violet #5B3E8E  8.44 / 4.02     teal   #1F6B6B  5.72 / 5.75
   Nothing here is under 4, which is why a member cannot pick their way
   into a page they cannot read. */
export const ACCENTS = [
  { k: 'green',  n: 'Green',  c: '#2F6B4A' },
  { k: 'blue',   n: 'Blue',   c: '#1F5C8B' },
  { k: 'clay',   n: 'Clay',   c: '#8A2B2B' },
  { k: 'gold',   n: 'Gold',   c: '#7A5500' },
  { k: 'violet', n: 'Violet', c: '#5B3E8E' },
  { k: 'teal',   n: 'Teal',   c: '#1F6B6B' },
];

/* 🔴 WHAT IS NOT ON THIS LIST IS THE POINT. The name, the handle, the
   face and THE DAY COUNT are not movable and not hideable — Ty, 20 Sept:
   "the sobriety counter still needs to be up on top of the header
   somewhere". The count stays in the card at the top of every page, where
   it has always been. (A member who wants it private already has the
   control for that: who can see your day count, in /me.) */
export const BLOCKS = [
  { k: 'song',  n: 'Your song',             d: 'The one that got you through' },
  { k: 'total', n: 'Days total, all of it', d: 'Your lifetime number' },
  { k: 'posts', n: 'What you’ve put up',    d: 'Your posts, newest first' },
];
export const DEFAULT_ORDER = ['song', 'total', 'posts'];

export function coverCss(k) {
  const c = COVERS.find((x) => x.k === k);
  return c && c.css !== 'none' ? c.css : null;
}
export function accentHex(k) {
  return (ACCENTS.find((x) => x.k === k) || ACCENTS[0]).c;
}

/* Anything unknown is dropped and anything missing is added, ON, at the
   end — a block introduced after somebody saved their order must never
   silently vanish from their page. */
export function normaliseSections(raw) {
  const rows = Array.isArray(raw) ? raw.filter((r) => r && BLOCKS.some((b) => b.k === r.k)) : [];
  const seen = new Set(rows.map((r) => r.k));
  for (const k of DEFAULT_ORDER) if (!seen.has(k)) rows.push({ k, on: true });
  return rows.map((r) => ({ k: r.k, on: r.on !== false }));
}
