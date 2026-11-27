'use client';
/* =====================================================================
   MY SHELF — kept on this phone only. 27 Nov 2026 (drop 2).

   What somebody in recovery reads is nobody's business, so the shelf and
   each book's bookmark live in localStorage, never in our database.
   No due dates, no streaks, no "you're behind" — Ty's rule from the
   readings page: a plan you are behind on is a streak wearing a robe.

   Every read and write is wrapped: storage can be missing or throw.
   ===================================================================== */
const KEY = 'sb_lib_v1';   // { saved: [ids, newest first], place: { id: { ch, at } } }

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { saved: [], place: {} }; }
  catch { return { saved: [], place: {} }; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* fine */ }
}

export function shelf() { return read(); }
export function isSaved(id) { return read().saved.includes(id); }
export function save(id) {
  const v = read();
  v.saved = [id, ...v.saved.filter((x) => x !== id)];
  write(v);
}
export function unsave(id) {
  const v = read();
  v.saved = v.saved.filter((x) => x !== id);
  write(v);
}
export function place(id) { return read().place[id] || null; }
export function setPlace(id, ch) {
  const v = read();
  v.place[id] = { ch, at: Date.now() };
  if (!v.saved.includes(id)) v.saved = [id, ...v.saved];   // reading it puts it on your shelf
  write(v);
}
