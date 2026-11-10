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

   Built to match the approved "Home Screen Walkthrough" prototype, which
   was drawn on Ty's own iPhone screenshots. Pictures live in
   public/setup/step1-4.jpg (no names or faces in any of them).

   🔴 WHY. 32 of 499 members get a buzz on their phone. An iPhone only
   allows alerts once Sober Book is on the home screen, and on a current
   iPhone that takes FIVE steps through Safari's own menus:
     ☰ in the address bar → Share → View More → scroll, Add to Home Screen
     → open the new icon.
   Apple owns those menus; a website can't tap them or skip them. So we
   show each one with a picture first, then pin a short list at the top
   of the screen (Apple's menus open from the bottom, so it stays readable).

   ⚠️ THE TRAP: "Add to Bookmarks" appears twice on the way and looks like
   the right thing. It isn't (no icon, no alerts). Ty's own test ended on
   it. Every step that passes it says so.

   Jobs, signed-in members only:
   1. Not on the home screen yet (iPhone Safari / Android Chrome), on the
      wall: the card → five steps → the pinned list.
   2. Opened from the home screen, alerts undecided: one question.
      Only "Yes" opens the phone's own permission box.
   3. Opened from the home screen: clears the red number on the icon.

   ⚠️ "Not now" waits 30 days on this phone (localStorage). "Start" waits
   7 days, in case they didn't finish.
   ⚠️ /wall?setup=1 always shows it (for Ty and Kenny to test).
   ⚠️ Never inside the Sober Book iPhone app or Facebook-style browsers
   (OpenInBrowser.jsx handles those).
   🔴 Not gated on the layout's `on` prop: the root layout is drawn once on
   the server, so right after signing in it still says "signed out" until a
   full reload. /wall is behind the middleware's sign-in check anyway.
   ===================================================================== */

const DAY = 24 * 60 * 60 * 1000;
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|musical_ly|TikTok|Bytedance|Snapchat|Line\//i;
const snooze = (k, days) => { try { localStorage.setItem(k, String(Date.now() + days * DAY)); } catch {} };
const due = (k) => { try { return Number(localStorage.getItem(k) || 0) < Date.now(); } catch { return true; } };
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function clearBadge() {
  try { navigator.clearAppBadge?.(); } catch {}
  try { caches.open('sb-v1-badge').then((c) => c.delete('/n')).catch(() => {}); } catch {}
}

const STEPS = [
  { t: 'Tap the lines in the address bar', s: 'At the bottom of your screen, left side.' },
  { t: 'Tap Share', s: 'Halfway down the menu. Not “Add to Bookmarks”.' },
  { t: 'Tap View More', s: 'Bottom row, far right.' },
  { t: 'Tap Add to Home Screen', s: 'Scroll down a little, it’s under Find on Page. Not “Bookmarks”. Then tap Add.' },
  { t: 'Open Sober Book from your home screen', s: 'The icon sits with your other apps. Don’t see it? Swipe left to your last page.' },
];

function StepPic({ n }) {
  if (n === 1) return (
    <div className="ps-pic"><img src="/setup/step1.jpg" alt="Safari’s address bar with the lines button" />
      <span className="ps-ring" style={{ left: '36.8%', top: '17.5%', width: '26.3%', height: '65.5%' }} /></div>
  );
  if (n === 2) return (
    <div className="ps-pic ps-mid"><img src="/setup/step2.jpg" alt="Safari’s menu with Share" />
      <span className="ps-ring" style={{ left: '21.4%', top: '41%', width: '57.2%', height: '23%' }} /></div>
  );
  if (n === 3) return (
    <div className="ps-pic"><img src="/setup/step3.jpg" alt="The share sheet with View More" />
      <span className="ps-ring" style={{ left: '71.6%', top: '3%', width: '26.6%', height: '70%' }} /></div>
  );
  if (n === 4) return (
    <div className="ps-pic ps-dark"><img className="ps-cut" src="/setup/step4.jpg" alt="The list after View More" />
      <div className="ps-row">⊞<span>Add to Home Screen</span><span className="ps-ring ps-in" /></div></div>
  );
  return (
    <div className="ps-pic ps-home">
      <div className="ps-grid">{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}
        <span className="ps-app"><img src="/icon-192.png" alt="" />Sober Book</span></div>
    </div>
  );
}

export default function PhoneSetup() {
  const path = usePathname();
  // null | card | steps | guide | android | ask
  const [mode, setMode] = useState(null);
  const [n, setN] = useState(1);          // steps 1-5, 6 = ready
  const [askState, setAskState] = useState('ask'); // ask | busy | done
  const prompt = useRef(null);

  useEffect(() => {
    const keep = (e) => { e.preventDefault(); prompt.current = e; };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);

  // The red number on the icon goes away whenever the app is looked at.
  useEffect(() => {
    if (isIosApp() || !isStandalone()) return;
    clearBadge();
    const vis = () => { if (document.visibilityState === 'visible') clearBadge(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  useEffect(() => {
    if (isIosApp() || path !== '/wall') return;
    const ua = navigator.userAgent || '';
    if (IN_APP.test(ua)) return;
    const force = new URLSearchParams(window.location.search).get('setup') === '1';
    const t = setTimeout(() => {
      if (isStandalone()) {
        if (!pushSupport().supported) return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
        if (force || due('sb_ask_next')) setMode('ask');
        return;
      }
      if (!force && !due('sb_home_next')) return;
      if (/iPhone|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) { setN(1); setMode('card'); }
      else if (/Android/i.test(ua) && prompt.current) setMode('android');
      else if (force) { setN(1); setMode('card'); }
    }, force ? 600 : 3000);
    return () => clearTimeout(t);
  }, [path]);

  if (!mode) return null;
  const close = (key, days) => { if (key) snooze(key, days); setMode(null); };

  if (mode === 'ask') {
    const yes = async () => {
      setAskState('busy');
      const supabase = browserClient();
      const { state } = await enablePush(supabase);
      try { await supabase.rpc('push_ask_done'); } catch {}
      if (state === 'on') { setAskState('done'); setTimeout(() => close(), 2600); }
      else close('sb_ask_next', 30);
    };
    return (
      <div className="ps-dim" role="dialog" aria-modal="true" aria-label="Alerts">
        <div className="ps-card ps-center">
          {askState === 'done' ? (
            <><div className="ps-emoji" aria-hidden="true">✅</div><b className="ps-big">You’re all set.</b>
              <p className="ps-sub">We’ll buzz you when someone answers.</p></>
          ) : (
            <>
              <div className="ps-emoji" aria-hidden="true">🔔</div>
              <b className="ps-big">Want a buzz when someone answers you?</b>
              <button type="button" className="ps-go" disabled={askState === 'busy'} onClick={yes}>
                {askState === 'busy' ? 'One second…' : 'Yes, turn it on'}
              </button>
              <button type="button" className="ps-no" disabled={askState === 'busy'} onClick={() => close('sb_ask_next', 30)}>Not now</button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'android') {
    const install = async () => {
      const p = prompt.current; prompt.current = null;
      if (p) { try { p.prompt(); await p.userChoice; } catch {} }
      close('sb_home_next', 30);
    };
    return (
      <div className="ps-sheet" role="dialog" aria-label="Put Sober Book on your home screen">
        <div className="ps-hd"><img src="/icon-192.png" alt="" /><b className="ps-big">Get a buzz when someone answers you</b></div>
        <p className="ps-sub">Put Sober Book on your home screen. One tap.</p>
        <button type="button" className="ps-go" onClick={install}>Put it on my home screen</button>
        <button type="button" className="ps-no" onClick={() => close('sb_home_next', 30)}>Not now</button>
      </div>
    );
  }

  if (mode === 'guide') {
    return (
      <>
        <div className="ps-guide" role="note" aria-label="Add Sober Book to your home screen">
          <b>5 steps · skip “Bookmarks”</b>
          <ol>
            <li><em>1</em>Tap the lines<small>☰</small></li>
            <li><em>2</em>Tap Share<small>⇪</small></li>
            <li><em>3</em>Tap View More<small>⌄</small></li>
            <li><em>4</em>Scroll down, tap Add to Home Screen<small>⊞</small></li>
            <li><em>5</em>Open Sober Book from your home screen<small>📱</small></li>
          </ol>
          <button type="button" className="ps-x" aria-label="Close" onClick={() => close()}>✕</button>
        </div>
        <div className="ps-bubble" aria-hidden="true">Tap here</div>
      </>
    );
  }

  if (mode === 'steps') {
    const ready = n === 6;
    const st = STEPS[n - 1];
    return (
      <div className="ps-sheet" role="dialog" aria-label="Put Sober Book on your home screen">
        <div className="ps-prog"><i style={{ width: (ready ? 100 : n * 20) + '%' }} /></div>
        <div className="ps-stepn">{ready ? 'ALL SET' : `STEP ${n} OF 5`}</div>
        <b className="ps-big">{ready ? 'That’s it. Ready?' : st.t}</b>
        <p className="ps-sub">{ready ? 'A short list stays at the top of your screen while you do it.' : st.s}</p>
        {!ready && <StepPic n={n} />}
        <button type="button" className="ps-go" onClick={() => {
          if (ready) { snooze('sb_home_next', 7); setMode('guide'); } else setN(n + 1);
        }}>{ready ? 'Start' : 'Next'}</button>
        {n === 1 && <div className="ps-bubble" aria-hidden="true">Tap here</div>}
      </div>
    );
  }

  // the card
  return (
    <div className="ps-sheet" role="dialog" aria-label="Put Sober Book on your home screen">
      <div className="ps-hd"><img src="/icon-192.png" alt="" /><b className="ps-big">Get a buzz when someone answers you</b></div>
      <p className="ps-sub">Put Sober Book on your home screen. Takes 20 seconds.</p>
      <button type="button" className="ps-go" onClick={() => { setN(1); setMode('steps'); }}>Show me how</button>
      <button type="button" className="ps-no" onClick={() => close('sb_home_next', 30)}>Not now</button>
    </div>
  );
}
