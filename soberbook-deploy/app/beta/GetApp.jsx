'use client';

import { useEffect, useState } from 'react';
import { track } from '../../lib/track';
import { TESTFLIGHT_APP, BETA_JOIN_LINK } from '../../lib/beta-links';

/* =====================================================================
   GET THE APP — 16 Nov 2026, Ty's approved "Beta Join Flow" prototype
   (one step per screen, every tap shown with the button circled).
   Shown in Beta Lab to a tester on an iPhone in Safari who hasn't agreed
   yet. 4 steps: Get TestFlight → come back → Accept/Install → sign in.
   The step is remembered on this phone so coming back from the App Store
   lands on the right screen.
   ===================================================================== */
const KEY = 'sb_getapp_step';

function TfIcon({ size = 56 }) {
  return (
    <span className="ga-ic ga-tf" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2.2" /><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
      </svg>
    </span>
  );
}
function RbIcon({ size = 56 }) {
  return <span className="ga-ic ga-rb" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">rb</span>;
}

function Progress({ n }) {
  return (
    <div className="ga-prog">
      <div className="ga-prog-t">Step {n} of 4{n === 1 ? ' · about 2 minutes total' : ''}</div>
      <div className="ga-bar" aria-label={`Step ${n} of 4`}>
        {[1, 2, 3, 4].map((i) => <span key={i} className={i <= n ? 'on' : ''} />)}
      </div>
    </div>
  );
}

export default function GetApp() {
  const [step, setStep] = useState(1);

  useEffect(() => {
    try { const s = +localStorage.getItem(KEY); if (s >= 1 && s <= 4) setStep(s); } catch { /* fine */ }
  }, []);
  function go(n) {
    setStep(n);
    try { localStorage.setItem(KEY, String(n)); } catch { /* fine */ }
    track('beta.getapp_step', { step: n });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  const ready = !!BETA_JOIN_LINK;

  return (
    <div className="ga">
      {step === 1 && <>
        <div className="ga-eyebrow">You&rsquo;re in · thank you</div>
        <Progress n={1} />
        <h2 className="ga-h">Get TestFlight</h2>
        <p className="ga-p">New apps are tested through <b>TestFlight</b>, Apple&rsquo;s free app. Tap the button below, the App Store opens, then tap <b>GET</b>.</p>
        <div className="ga-pic">
          <div className="ga-row"><TfIcon /><div className="ga-name"><b>TestFlight</b><span>Apple</span></div><span className="ga-pill ga-ring">GET</span></div>
        </div>
        <p className="ga-cap">What you&rsquo;ll see in the App Store. Tap the circled button.</p>
        <div className="ga-tip"><b>!</b><span>If it asks, confirm with Face ID or your passcode.</span></div>
        <a className="ga-btn ga-dark" href={TESTFLIGHT_APP} target="_blank" rel="noopener noreferrer" onClick={() => go(2)}>Open the App Store</a>
        <p className="ga-small">Already have TestFlight? <button type="button" className="ga-link" onClick={() => go(3)}>Skip this step</button></p>
      </>}

      {step === 2 && <>
        <Progress n={2} />
        <h2 className="ga-h">Now come back here</h2>
        <p className="ga-p">When the App Store button says <b>OPEN</b>, don&rsquo;t open TestFlight yet. Come back to this page first.</p>
        <div className="ga-pic">
          <div className="ga-row"><span className="ga-back ga-ring">◀ Safari</span></div>
          <div className="ga-row"><TfIcon size={48} /><div className="ga-name"><b>TestFlight</b><span>Installed</span></div><span className="ga-pill">OPEN</span></div>
        </div>
        <p className="ga-cap">Tap the tiny &ldquo;◀ Safari&rdquo; in the top left corner of your screen.</p>
        <button type="button" className="ga-btn" onClick={() => go(3)}>I&rsquo;m back, next step</button>
        <p className="ga-small">Can&rsquo;t find it? Just open Safari again. This page will still be here.</p>
      </>}

      {step === 3 && <>
        <Progress n={3} />
        <h2 className="ga-h">Get Recovery Belongs</h2>
        <p className="ga-p">Tap the green button. TestFlight opens. Tap <b>Accept</b>, then <b>Install</b>.</p>
        <div className="ga-pic">
          <div className="ga-row"><RbIcon /><div className="ga-name"><b>Recovery Belongs</b><span>Our new app</span></div></div>
          <div className="ga-two"><span className="ga-blue ga-ring">1 · Accept</span><span className="ga-blue ga-ring">2 · Install</span></div>
        </div>
        <p className="ga-cap">What you&rsquo;ll see in TestFlight. Tap Accept first, then Install.</p>
        <div className="ga-tip"><b>!</b><span>Give it a few seconds to download. When it says <b>Open</b>, tap it.</span></div>
        {ready
          ? <a className="ga-btn" href={BETA_JOIN_LINK} target="_blank" rel="noopener noreferrer"
              onClick={() => { track('beta.get_app'); go(4); }}>Get the app</a>
          : <span className="ga-btn ga-off" aria-disabled="true">Link coming in a moment</span>}
        <p className="ga-small"><button type="button" className="ga-link" onClick={() => go(1)}>Don&rsquo;t have TestFlight yet? Go back to step 1</button></p>
      </>}

      {step === 4 && <>
        <Progress n={4} />
        <h2 className="ga-h">Sign in, and you&rsquo;re in</h2>
        <p className="ga-p">Open <b>Recovery Belongs</b> and use the <b>same email and password</b> you use for Sober Book. No new account. Everything you have is already there.</p>
        <div className="ga-pic ga-signin">
          <RbIcon size={52} />
          <div className="ga-wm">recovery belongs</div>
          <div className="ga-field">Your Sober Book email</div>
          <div className="ga-field">Your Sober Book password</div>
          <div className="ga-fake-go">Sign in</div>
        </div>
        <p className="ga-cap">What you&rsquo;ll see when the new app opens.</p>
        <div className="ga-done"><RbIcon size={34} /><span>From now on, open <b>Recovery Belongs</b> from your home screen. It&rsquo;s the navy <b>rb</b> icon.</span></div>
        <p className="ga-small"><button type="button" className="ga-link" onClick={() => go(3)}>App didn&rsquo;t install? Go back a step</button></p>
      </>}

      <p className="ga-small ga-help">Stuck on any step? Tap More, then Report a problem. Ty or Kenny will help you get in.</p>
    </div>
  );
}
