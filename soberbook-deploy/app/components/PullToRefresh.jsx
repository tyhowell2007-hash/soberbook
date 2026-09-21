'use client';

import { useEffect, useRef, useState } from 'react';

/* =====================================================================
   PULL THE SCREEN DOWN TO RELOAD.

   This is mounted once in the root layout and only switched on for a
   signed-in member. A full reload is deliberate: several screens combine
   server components, browser-side Supabase subscriptions and cached route
   state, so router.refresh() alone would not refresh every source.

   SAFETY RULES:
   - The gesture can only begin while the document is already at the top.
   - Horizontal movement cancels it, so story rails and carousels still
     swipe normally.
   - Controls, dialogs and independently scrolling panels are ignored.
   - The browser's normal scrolling is prevented only after a downward,
     vertical gesture has been confirmed.
   ===================================================================== */

const TRIGGER_DISTANCE = 68;
const MAX_DISTANCE = 104;
const RESISTANCE = 0.55;
const AXIS_SLOP = 8;
const SETTLE_MS = 180;

function pageIsAtTop() {
  return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
}

function isBlockedTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    'a, button, input, textarea, select, [contenteditable="true"], ' +
    '[role="dialog"], [data-no-pull-refresh]'
  ));
}

/* Chat threads, menus and pickers own their scroll position. Pulling at
   the top of one of those regions should move that region, not reload the
   whole app. */
function startsInsideScrollableRegion(target) {
  if (!(target instanceof Element)) return false;

  for (let node = target; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    const scrolls = /^(auto|scroll|overlay)$/.test(overflowY)
      && node.scrollHeight > node.clientHeight + 1;
    if (scrolls) return true;
  }

  return false;
}

/* 🔴 20 SEPT — THE ONE THING THIS GESTURE CAN COST SOMEBODY.
   It ends in a full document reload, and it fires at the TOP of the
   page. On the wall, the top of the page is the composer. So a member
   half-way through writing a post, who pulls down out of the habit
   every other app has taught them, loses what they wrote.

   On most apps that is a papercut. Here it is somebody typing the
   hardest thing they will type this week, at 2am, watching it vanish —
   and not typing it again. That is worth a few lines.

   ⚠️ NOT THE SAME CHECK AS isBlockedTarget(). That one asks where the
   FINGER landed, and correctly refuses to start a pull that begins on a
   textarea. This asks whether anything on the page is holding unsaved
   words, wherever the finger is. Both are needed: you can have a post
   half-written and still put your thumb on empty paper beside it.

   Hidden fields are skipped — a collapsed editor somewhere in the page
   holding old text must not quietly disable the gesture everywhere. */
function hasUnsavedWriting() {
  const fields = document.querySelectorAll(
    'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable="true"]'
  );
  for (const el of fields) {
    /* offsetParent is null for anything display:none or inside it. */
    if (el.offsetParent === null) continue;
    const value = el.isContentEditable ? el.textContent : el.value;
    if (value && value.trim()) return true;
  }
  return false;
}

export default function PullToRefresh({ on = false }) {
  const [distance, setDistance] = useState(0);
  const [phase, setPhase] = useState('idle');

  const tracking = useRef(false);
  const axis = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const distanceNow = useRef(0);
  const phaseNow = useRef('idle');
  const hideTimer = useRef(null);
  const reloadTimer = useRef(null);

  useEffect(() => {
    if (!on || typeof window === 'undefined') return;

    document.documentElement.classList.add('ptr-enabled');

    const showPhase = (next) => {
      if (phaseNow.current === next) return;
      phaseNow.current = next;
      setPhase(next);
    };

    const stopTracking = () => {
      tracking.current = false;
      axis.current = null;
    };

    const settle = () => {
      const wasVisible = phaseNow.current !== 'idle';
      stopTracking();
      distanceNow.current = 0;
      setDistance(0);
      window.clearTimeout(hideTimer.current);
      if (!wasVisible) return;
      showPhase('settling');
      hideTimer.current = window.setTimeout(() => showPhase('idle'), SETTLE_MS);
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || !pageIsAtTop()) return;
      if (document.body.style.overflow === 'hidden') return;
      if (isBlockedTarget(event.target) || startsInsideScrollableRegion(event.target)) return;
      /* Nothing happens rather than something surprising — the same way
         this already declines to start on a control. See the note above
         hasUnsavedWriting(). */
      if (hasUnsavedWriting()) return;

      window.clearTimeout(hideTimer.current);
      tracking.current = true;
      axis.current = null;
      startX.current = event.touches[0].clientX;
      startY.current = event.touches[0].clientY;
      distanceNow.current = 0;
    };

    const onTouchMove = (event) => {
      if (!tracking.current || event.touches.length !== 1) return;

      const dx = event.touches[0].clientX - startX.current;
      const dy = event.touches[0].clientY - startY.current;

      if (axis.current === null) {
        if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
        if (Math.abs(dx) >= Math.abs(dy) || dy <= 0) {
          stopTracking();
          return;
        }
        axis.current = 'vertical';
        showPhase('pulling');
      }

      if (dy <= 0 || !pageIsAtTop()) {
        settle();
        return;
      }

      /* Only the confirmed pull is captured. Ordinary taps, horizontal
         swipes and upward scrolling never reach preventDefault(). */
      if (event.cancelable) event.preventDefault();

      const nextDistance = Math.min(MAX_DISTANCE, Math.round(dy * RESISTANCE));
      distanceNow.current = nextDistance;
      setDistance(nextDistance);
      showPhase(nextDistance >= TRIGGER_DISTANCE ? 'ready' : 'pulling');
    };

    const onTouchEnd = () => {
      if (!tracking.current) return;

      if (distanceNow.current >= TRIGGER_DISTANCE) {
        stopTracking();
        showPhase('refreshing');
        distanceNow.current = 54;
        setDistance(54);

        /* Give the status change one paint before navigation replaces the
           document. If reload ever throws, return the indicator to rest. */
        reloadTimer.current = window.setTimeout(() => {
          try {
            window.location.reload();
          } catch {
            settle();
          }
        }, 140);
        return;
      }

      settle();
    };

    const onTouchCancel = () => {
      if (tracking.current) settle();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.documentElement.classList.remove('ptr-enabled');
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(reloadTimer.current);
    };
  }, [on]);

  if (!on) return null;

  const label = phase === 'ready'
    ? 'Release to refresh'
    : phase === 'refreshing'
      ? 'Refreshing…'
      : 'Pull to refresh';

  return (
    <div
      className="ptr-indicator"
      data-phase={phase}
      data-visible={phase !== 'idle'}
      style={{ '--ptr-distance': `${distance}px` }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={phase === 'idle'}
    >
      <span className="ptr-icon" aria-hidden="true">
        <span className="ptr-arrow">↓</span>
        <span className="ptr-spinner" />
      </span>
      <span>{label}</span>
    </div>
  );
}
