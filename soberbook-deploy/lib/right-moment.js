'use client';
/* =====================================================================
   RIGHT MOMENT RESOURCES — the rules. 27 Nov 2026 (Kenny, drop 3).
   Spec: Kenny's "Right Moment Resources — trigger rules" doc.

   One small engine, used by the pop-up (RightMoment.jsx) and the feed
   nudge (ToolNudge.jsx). It decides WHAT to suggest and WHEN to stay
   quiet. It never reads anything a member wrote: only actions (a
   check-in's craving level, a milestone, screens opened, time of day).

   ⭐ EVERYTHING LIVES ON THE PHONE (localStorage, key sb_rm_v1). We store
   nothing about who saw or skipped what, apart from beta testers'
   counts-only events through track(), like every beta event.

   The limits, word for word from the doc:
   • Pop-ups: at most one a day, never in the first 2 minutes after
     opening the app.
   • Feed nudges: at most two a week, For You included (shares
     sb_fy_nudge_days with ForYouNudge, so the cap is one cap).
   • Snooze is per resource AND per reason, 7 days. A different reason is
     still fair game.
   • Three no's to the same resource, any reason → it rests 30 days.
   • Tapped it, or has opened that tool before → not suggested again.
   • Safety first: after a rough check-in, crisis help sits above any tool.
   • The resume builder is listed first wherever it fits.
   ===================================================================== */

const KEY = 'sb_rm_v1';
const DAY = 86400000;
const WEEK = 7 * DAY;

/* Every tool the engine can suggest. `paths` are the screens that count
   as having tried it. Copy is one plain line, written for a hard day. */
export const RESOURCES = {
  resume:  { label: 'Resume builder', sub: 'A professional resume, ready to send in minutes', href: '/resume', paths: ['/resume'], hot: true,
             nudge: 'Have you tried the resume builder?', nudgeSub: 'A professional resume in minutes. Free, and nobody sees it but you.' },
  library: { label: 'The Library', sub: 'Free books and guides, read right here', href: '/library', paths: ['/library'],
             nudge: 'Did you know there’s a free Library?', nudgeSub: 'Recovery books and guides you can read right here, or save for later.' },
  plan:    { label: 'Your safety plan', sub: 'What to do on a hard day', href: '/plan', paths: ['/plan'] },
  now:     { label: 'Ride out the craving', sub: 'A few minutes, step by step', href: '/now', paths: ['/now'] },
  meeting: { label: 'A meeting tonight', sub: 'Online or near you', href: '/meetings', paths: ['/meetings'] },
  quiet:   { label: 'Quiet', sub: 'No advice, no fixing', href: '/quiet', paths: ['/quiet'],
             nudge: 'Up late? There’s a Quiet room.', nudgeSub: 'No advice, no fixing. Just somewhere calm to be.' },
  care:    { label: 'Find care', sub: 'Treatment near you', href: '/rm', paths: ['/rm'] },
};

/* Feed-nudge rotation once For You has been opened: each tool the member
   hasn't tried gets one introduction before any gets a second. Resume
   first, per the doc. */
const NUDGE_ORDER = [
  { res: 'resume',  reason: 'never_tried_resume',  minDays: 30 },
  { res: 'library', reason: 'never_tried_library', minDays: 7 },
];

function now() { return Date.now(); }
function load() {
  try { return { tried: {}, snooze: {}, nos: {}, done: {}, pop: 0, opens: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { tried: {}, snooze: {}, nos: {}, done: {}, pop: 0, opens: [] }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ } }

/* ---------- what the member has done ---------- */

/* Called on every screen change. Marks a tool as tried. */
export function noteScreen(path) {
  const s = load();
  let changed = false;
  for (const [id, r] of Object.entries(RESOURCES)) {
    if (!s.tried[id] && r.paths.some((p) => path === p || path.startsWith(p + '/'))) {
      s.tried[id] = now(); changed = true;
    }
  }
  if (changed) save(s);
}

/* Called once per app open. Returns the "comeback" reasons it notices:
   welcome_back (first open after 5+ days away) and late_nights (2+ opens
   after 11pm, New York time, in the last week). */
export function noteOpen() {
  const s = load();
  const t = now();
  const last = s.opens.length ? s.opens[s.opens.length - 1].t : 0;
  if (!s.first) s.first = t;
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(new Date(t)));
  const late = hour >= 23 || hour < 4;
  s.opens = [...s.opens.filter((o) => t - o.t < WEEK), { t, late }].slice(-40);
  s.openedAt = t;
  save(s);
  const reasons = [];
  if (last && t - last > 5 * DAY) reasons.push('welcome_back');
  if (s.opens.filter((o) => o.late).length >= 2) reasons.push('late_nights');
  return reasons;
}

export function daysSinceFirstSeen() {
  const s = load();
  return s.first ? Math.floor((now() - s.first) / DAY) : 0;
}

/* ---------- may we suggest it? ---------- */

function sk(res, reason) { return res + ':' + reason; }

export function allowed(res, reason) {
  const s = load();
  const t = now();
  if (s.tried[res]) return false;                     // already found it
  if (s.done[sk(res, reason)]) return false;          // tapped it for this reason
  if ((s.snooze[sk(res, reason)] || 0) > t) return false;
  const n = s.nos[res];
  if (n && n.count >= 3 && t - n.last < 30 * DAY) return false;
  return true;
}

export function tapped(res, reason) {
  const s = load();
  s.done[sk(res, reason)] = now();
  save(s);
}

export function snoozed(res, reason) {
  const s = load();
  const t = now();
  s.snooze[sk(res, reason)] = t + WEEK;
  const n = s.nos[res] && t - s.nos[res].last < 30 * DAY ? s.nos[res] : { count: 0, last: 0 };
  s.nos[res] = { count: n.count + 1, last: t };
  save(s);
}

/* ---------- the pop-up ---------- */

/* What a moment offers, in order. `safety` puts crisis help on top.
   Resume goes first wherever it fits (the doc's "extra push"). */
export function popupFor(reason, ctx = {}) {
  let list = [];
  let safety = false;
  if (reason === 'hard_checkin') { list = ['now', 'plan', 'meeting']; safety = true; }
  if (reason === 'milestone') list = [...((ctx.days || 0) >= 90 ? ['resume'] : []), 'library'];
  if (reason === 'welcome_back') list = ['plan', 'meeting', 'library'];
  /* Crisis-adjacent tools are never "tried and retired": on a rough day
     the plan and the craving page should always be offered. */
  const always = reason === 'hard_checkin' || reason === 'welcome_back';
  const items = list.filter((r) => (always && r !== 'library') || allowed(r, reason)).slice(0, 3);
  return { items, safety };
}

export function popupAllowedNow() {
  const s = load();
  const t = now();
  if (s.openedAt && t - s.openedAt < 2 * 60 * 1000) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
  return s.popDay !== today;
}

/* hard_checkin skips the 2-minute rule: it's the moment itself, and the
   safety line must not wait. It still counts toward one a day. */
export function markPopupShown() {
  const s = load();
  s.popDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  save(s);
}

/* ---------- the feed nudge ---------- */

const FY_DAYS = 'sb_fy_nudge_days';
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); }

/* Shares ForYouNudge's two-days-a-week cap. Returns true if today may
   carry a nudge (and books today if it wasn't already). */
export function claimNudgeDay() {
  let days = [];
  try { days = JSON.parse(localStorage.getItem(FY_DAYS) || '[]'); } catch { days = []; }
  const t = now();
  const d = today();
  days = days.filter((x) => t - new Date(x + 'T12:00:00').getTime() < WEEK);
  if (!days.includes(d)) {
    if (days.length >= 2) return false;
    days.push(d);
    try { localStorage.setItem(FY_DAYS, JSON.stringify(days)); } catch { /* fine */ }
  }
  return true;
}

/* Which single-tool nudge is due, if any. `days` is the member's sober
   day count when we have it, otherwise days since this phone first saw
   them. late_nights offers Quiet then the Library. */
export function nudgeFor({ days, lateNights }) {
  const d = Number.isFinite(days) ? days : daysSinceFirstSeen();
  const s = load();
  const cands = [
    ...NUDGE_ORDER.filter((n) => d >= n.minDays),
    ...(lateNights ? [{ res: 'quiet', reason: 'late_nights' }, { res: 'library', reason: 'late_nights' }] : []),
  ];
  /* Least-introduced first, so every tool gets one turn before a second. */
  const shown = s.shownCount || {};
  const ok = cands.filter((c) => allowed(c.res, c.reason));
  ok.sort((a, b) => (shown[a.res] || 0) - (shown[b.res] || 0));
  return ok[0] || null;
}

export function markNudgeShown(res, reason) {
  const s = load();
  s.shownCount = { ...(s.shownCount || {}), [res]: ((s.shownCount || {})[res] || 0) + 1 };
  s.lastNudge = { res, reason, day: today() };
  save(s);
}

/* The same nudge stays put for the rest of the day it was shown. */
export function todaysNudge() {
  const s = load();
  return s.lastNudge && s.lastNudge.day === today() ? { res: s.lastNudge.res, reason: s.lastNudge.reason } : null;
}

export function lateNightsNow() {
  const s = load();
  return s.opens.filter((o) => o.late).length >= 2;
}

/* Fire a moment from anywhere: window.dispatchEvent(...) is caught by
   RightMoment.jsx in the root layout. */
export function moment(reason, ctx = {}) {
  try { window.dispatchEvent(new CustomEvent('sb:moment', { detail: { reason, ...ctx } })); } catch { /* fine */ }
}
