'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import { enablePush, pushSupport } from '../../lib/push';
import { isIosApp } from '../../lib/is-ios-app';
import './phone-setup.css';

/* =====================================================================
   ⭐ PUT IT ON YOUR PHONE — 9 Nov 2026, "easier than an app" part 2.
   Ty: "simplicity is the key… it's up to them now to get through it
   themselves. We're not going to be there to help them."

   🔴 WHY. 32 of 499 members get a buzz on their phone. Alerts were built
   in August; most iPhone members simply can't receive them, because an
   iPhone only allows them once Sober Book is on the home screen, and the
   only place that said so was a sentence at the bottom of /me.

   Three jobs, all from the root layout, signed-in members only:
   1. NOT ON THE HOME SCREEN YET (iPhone Safari / Android Chrome), on the
      wall only: one card. "Show me" → a picture of the real Share button
      and the real "Add to Home Screen" row. Android gets Chrome's own
      one-tap Install instead.
   2. OPENED FROM THE HOME SCREEN, alerts not decided yet: one question,
      "Want a buzz when someone answers you?", Yes or Not now. Yes is the
      only thing that ever calls the phone's own permission box (the soft
      ask from PushAsk.jsx; a "no" there is forever on iPhone).
   3. OPENED FROM THE HOME SCREEN: clears the red number on the icon
      (public/sw.js counts alerts onto it while the app is closed).

   ⚠️ "Not now" waits 30 days before asking again, on this phone only
   (localStorage). Never a nag, never a streak.
   ⚠️ Never inside the Sober Book iPhone app, and never inside Facebook-
   style browsers (OpenInBrowser.jsx handles those).
   ⚠️ Not on Kenny's Home cards: it floats over the page from the layout.
   ===================================================================== */

const WAIT = 30 * 24 * 60 * 60 * 1000;
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|musical_ly|TikTok|Bytedance|Snapchat|Line\//i;
const later = (k) => { try { localStorage.setItem(k, String(Date.now() + WAIT)); } catch {} };
const due = (k) => { try { return Number(localStorage.getItem(k) || 0) < Date.now(); } catch { return true; } };

function clearBadge() {
  try { navigator.clearAppBadge?.(); } catch {}
  try { caches.open('sb-v1-badge').then((c) => c.delete('/n')).catch(() => {}); } catch {}
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

export default function PhoneSetup({ on }) {
  const path = usePathname();
  const [mode, setMode] = useState(null);   // null | install-ios | install-android | ask
  const [step, setStep] = useState(0);      // install: 0 card, 1 steps · ask: 0 ask, 1 busy, 2 done
  const prompt = useRef(null);

  // Android Chrome hands over its own Install box; keep it for the button.
  useEffect(() => {
    const keep = (e) => { e.preventDefault(); prompt.current = e; };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);

  // The red number on the icon goes away whenever the app is looked at.
  useEffect(() => {
    if (!on || isIosApp()) return;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!standalone) return;
    clearBadge();
    const vis = () => { if (document.visibilityState === 'visible') clearBadge(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [on]);

  useEffect(() => {
    if (!on || isIosApp() || path !== '/wall') return;
    const ua = navigator.userAgent || '';
    if (IN_APP.test(ua)) return;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const t = setTimeout(() => {
      if (standalone) {
        if (!pushSupport().supported) return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
        if (due('sb_ask_next')) setMode('ask');
        return;
      }
      if (!due('sb_home_next')) return;
      if (/iPhone|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) setMode('install-ios');
      else if (/Android/i.test(ua) && prompt.current) setMode('install-android');
    }, 3000);
    return () => clearTimeout(t);
  }, [on, path]);

  if (!mode) return null;

  const close = (key) => { if (key) later(key); setMode(null); setStep(0); };

  if (mode === 'ask') {
    const yes = async () => {
      setStep(1);
      const supabase = browserClient();
      const { state } = await enablePush(supabase);
      try { await supabase.rpc('push_ask_done'); } catch {}
      if (state === 'on') { setStep(2); setTimeout(() => close(), 2500); }
      else close('sb_ask_next');
    };
    return (
      <div className="ps-dim" role="dialog" aria-modal="true" aria-label="Alerts">
        <div className="ps-card ps-center">
          {step === 2 ? (
            <><div className="ps-emoji" aria-hidden="true">✅</div><b className="ps-big">You’re all set.</b></>
          ) : (
            <>
              <div className="ps-emoji" aria-hidden="true">🔔</div>
              <b className="ps-big">Want a buzz when someone answers you?</b>
              <button type="button" className="ps-go" disabled={step === 1} onClick={yes}>
                {step === 1 ? 'One second…' : 'Yes, turn it on'}
              </button>
              <button type="button" className="ps-no" disabled={step === 1} onClick={() => close('sb_ask_next')}>Not now</button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'install-android') {
    const install = async () => {
      const p = prompt.current; prompt.current = null;
      if (!p) return close('sb_home_next');
      try { p.prompt(); await p.userChoice; } catch {}
      close('sb_home_next');
    };
    return (
      <div className="ps-sheet" role="dialog" aria-label="Put Sober Book on your home screen">
        <div className="ps-row"><img src="/icon-192.png" alt="" className="ps-icon" /><b className="ps-big">Get a buzz when someone answers you</b></div>
        <button type="button" className="ps-go" onClick={install}>Put it on my home screen</button>
        <button type="button" className="ps-no" onClick={() => close('sb_home_next')}>Not now</button>
      </div>
    );
  }

  // iPhone
  return (
    <div className={'ps-sheet' + (step === 1 ? ' ps-low' : '')} role="dialog" aria-label="Put Sober Book on your home screen">
      {step === 0 ? (
        <>
          <div className="ps-row"><img src="/icon-192.png" alt="" className="ps-icon" /><b className="ps-big">Get a buzz when someone answers you</b></div>
          <button type="button" className="ps-go" onClick={() => setStep(1)}>Show me</button>
          <button type="button" className="ps-no" onClick={() => close('sb_home_next')}>Not now</button>
        </>
      ) : (
        <>
          <div className="ps-step"><em>1</em><span>Tap <b>Share</b> at the bottom of Safari <small className="ps-small">On newer iPhones, tap <b>•••</b> first</small></span><i className="ps-pic"><ShareIcon /></i></div>
          <div className="ps-step"><em>2</em><span>Tap <b>Add to Home Screen</b> <small className="ps-small">Scroll down if you don’t see it</small></span><i className="ps-pic ps-add">⊞</i></div>
          <div className="ps-step"><em>3</em><span>Open Sober Book from your home screen</span><i className="ps-pic"><img src="/icon-192.png" alt="" /></i></div>
          <button type="button" className="ps-no" onClick={() => close('sb_home_next')}>Close</button>
          <div className="ps-arrow" aria-hidden="true">⬇︎</div>
        </>
      )}
    </div>
  );
}
