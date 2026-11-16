'use client';
/* =====================================================================
   BETA USAGE TRACKING — Kenny's plan, 15 Nov 2026 (0206).
   Written by Kenny's Claude; reviewed and fixed by Ty's Claude.

   Sends ACTIONS only (screens, taps, timing). NEVER anything a member
   typed. The server also strips text/body/query/message keys.

   ⭐ FIXES vs Kenny's draft:
   · Nothing leaves the phone unless the server says this member is a
     tester who has agreed and has tracking on (my_beta_status, asked once
     per page load). Before, every member's phone sent every tap and the
     server threw them away.
   · Events go up in one call every 2 seconds (track_events), not one call
     per tap.
   · Screen names never carry an @handle, a post id or a chat id — a
     profile counts as "/u/:handle", so nobody can see WHOSE page a tester
     opened.
   · Relative imports (this repo has no "@/" alias).
   ===================================================================== */
import { browserClient } from './supabase-browser';
import { isIosApp } from './is-ios-app';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'web';
let sessionId = null;
let currentScreen = null;
let screenStart = 0;
let activeMission = null;
let queue = [];
let flushTimer = null;
let lastTap = { key: null, t: 0, n: 0 };
let allowed = null;          // null = not asked yet, then true/false
let asking = null;

/* Turns /u/CedarLane88 into /u/:handle and /p/1b2c… into /p/:id. */
export function screenName(path) {
  const parts = (path || '/').split('?')[0].split('/');
  const out = parts.map((p, i) => {
    const prev = parts[i - 1];
    if (!p) return p;
    if (/^[0-9a-f-]{8,}$/i.test(p) || /^\d+$/.test(p)) return ':id';
    if (['u', 'card', 'p'].includes(prev)) return prev === 'p' ? ':id' : ':handle';
    if (['slips', 'sign', 'unsub', 'chat', 'talks', 'room'].includes(prev)) return ':id';
    if (p.startsWith('@')) return ':handle';
    return p;
  });
  return out.join('/').slice(0, 64) || '/';
}

function session() {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem('sb_session');
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('sb_session', sessionId);
    }
  } catch { sessionId = 'nosession'; }
  return sessionId;
}

/* Ask the server once whether this member's phone should send anything. */
function checkAllowed() {
  if (allowed !== null) return Promise.resolve(allowed);
  if (asking) return asking;
  asking = browserClient().rpc('my_beta_status').then(({ data }) => {
    allowed = !!(data && data.agreed && data.tracking);
    if (!allowed) queue = [];
    return allowed;
  }).catch(() => { allowed = false; queue = []; return false; });
  return asking;
}

/* Call after "I agree" or the tracking switch so the answer is asked again. */
export function refreshBetaStatus() { allowed = null; asking = null; }

export function setActiveMission(id) { activeMission = id || null; }

export function track(name, props = {}) {
  if (typeof window === 'undefined' || allowed === false) return;
  queue.push({
    name,
    props: {
      ...props,
      screen: props.screen || currentScreen,
      session: session(),
      v: APP_VERSION,
      ios: isIosApp(),
      mission: activeMission || undefined,
    },
  });
  if (queue.length > 200) queue = queue.slice(-200);
  if (!flushTimer) flushTimer = setTimeout(flush, 2000);
}

async function flush() {
  flushTimer = null;
  if (!(await checkAllowed())) return;
  while (queue.length) {
    const batch = queue.splice(0, 50);
    try { await browserClient().rpc('track_events', { p_events: batch }); } catch { /* best effort */ }
  }
}

export function trackScreen(screen) {
  const now = Date.now();
  if (currentScreen) track('screen.leave', { screen: currentScreen, ms: now - screenStart });
  currentScreen = screen;
  screenStart = now;
  track('screen.view', { screen });
}

/* Taps. A stable key like 'post.like', never text. */
export function trackTap(key, extra = {}) {
  const now = Date.now();
  if (lastTap.key === key && now - lastTap.t < 600) {
    lastTap.n += 1;
    if (lastTap.n === 3) track('tap.rage', { el: key });
  } else {
    lastTap = { key, t: now, n: 1 };
  }
  lastTap.t = now;
  track('tap', { el: key, ...extra });
}

export function trackError(where, code) {
  track('error', { where, code: String(code || '').slice(0, 40) });
}

export function initTracking() {
  if (typeof window === 'undefined' || window.__sbTrack) return;
  window.__sbTrack = true;
  checkAllowed().then((ok) => { if (!ok) return; track('app.open'); setup(); });
}

function setup() {
  let maxScroll = 0;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = Math.round(((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100);
    if (pct > maxScroll + 24) { maxScroll = pct - (pct % 25); track('scroll.depth', { pct: maxScroll }); }
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (currentScreen) track('screen.leave', { screen: currentScreen, ms: Date.now() - screenStart });
      track('app.close');
      flush();
      maxScroll = 0;
    } else {
      screenStart = Date.now();
      track('app.resume');
    }
  });

  if (!isIosApp() && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    const starts = new Map();
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('[data-track-hover]');
      if (el) starts.set(el, Date.now());
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest?.('[data-track-hover]');
      if (el && starts.has(el)) {
        const ms = Date.now() - starts.get(el);
        starts.delete(el);
        if (ms > 400) track('hover', { el: el.dataset.trackHover, ms });
      }
    });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-track]');
    if (el) trackTap(el.dataset.track);
  });

  window.addEventListener('error', () => trackError('window', 'js_error'));

  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) track('perf.load', { ms: Math.round(nav.duration) });
  } catch { /* old browser */ }
}

/* Items in view (dwell). Pass an element and a stable key. */
export function observeDwell(el, key) {
  if (!el || typeof IntersectionObserver === 'undefined') return () => {};
  let start = 0;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start = Date.now();
    else if (start) { const ms = Date.now() - start; start = 0; if (ms > 1000) track('dwell', { el: key, ms }); }
  }, { threshold: 0.6 });
  io.observe(el);
  return () => io.disconnect();
}
