'use client';

import { useEffect, useState } from 'react';
import './open-in-browser.css';

/* =====================================================================
   ⭐ "OPEN IN SAFARI" — 9 Nov 2026, "easier than an app" part 1.
   Ty: "simplicity is the key… we're not going to be there to help them."

   🔴 WHY. A Sober Book link tapped inside Facebook, Instagram, Messenger,
   TikTok or Snapchat opens in THAT app's own little browser. It never has
   the member's sign-in, so they land on this page signed out, try to sign
   in again, and the next link from Facebook does it all over. To them it
   looks like Sober Book keeps logging them out.

   One button sends them to their real browser, where they already are.
   iPhone: the x-safari-https:// address opens Safari from most in-app
   browsers (iOS 17+). Android: an intent:// address opens Chrome. If the
   app swallows it, the link is already copied and one line says where the
   "open in browser" item lives.

   ⚠️ Shows ONLY inside those apps (by the browser's own name for itself),
   never in Safari, Chrome or the Sober Book iPhone app.
   ===================================================================== */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|musical_ly|TikTok|Bytedance|Snapchat|Line\//i;

export default function OpenInBrowser() {
  const [where, setWhere] = useState(null); // null | 'ios' | 'android'
  const [tried, setTried] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (!IN_APP.test(ua)) return;
    setWhere(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : null);
  }, []);

  if (!where || gone) return null;

  const go = () => {
    const here = window.location.href;
    try { navigator.clipboard?.writeText(here); } catch {}
    setTried(true);
    const noScheme = here.replace(/^https?:\/\//, '');
    window.location.href = where === 'ios'
      ? 'x-safari-https://' + noScheme
      : 'intent://' + noScheme + '#Intent;scheme=https;package=com.android.chrome;end';
  };

  const browser = where === 'ios' ? 'Safari' : 'Chrome';
  return (
    <div className="oib" role="region" aria-label={'Open in ' + browser}>
      <b>Open Sober Book in {browser}</b>
      <p>This app’s browser won’t keep you signed in. {browser} will.</p>
      <button type="button" className="oib-go" onClick={go}>Open in {browser}</button>
      {tried ? (
        <p className="oib-how">
          Didn’t open? Tap <b>•••</b> at the top, then <b>Open in {where === 'ios' ? 'external browser' : 'Chrome'}</b>.
          The link is copied too, so you can paste it.
        </p>
      ) : (
        <button type="button" className="oib-no" onClick={() => setGone(true)}>Not now</button>
      )}
    </div>
  );
}
