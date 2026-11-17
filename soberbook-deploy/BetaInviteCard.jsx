'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import BrandName from './BrandName';
import { isPhone, isIPhoneBrowser } from '../../lib/is-phone';
import '../beta/beta.css';

/* =====================================================================
   THE BETA INVITE ON THE WALL — Kenny's plan, 0206, 15 Nov 2026.
   Renders nothing unless Ty or Kenny invited this member from /admin/beta
   and they haven't answered. "No thanks" is final: the card never comes
   back and they can't be invited again. Kenny's words.
   ===================================================================== */
export default function BetaInviteCard() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remind, setRemind] = useState(false);
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    if (!isPhone()) return;          // phones only (Ty, 15 Nov)
    const ip = isIPhoneBrowser();
    setIphone(ip);
    browserClient().rpc('my_beta_invite').then(({ data }) => {
      setShow(!!data);
      // 16 Nov: said "I'm in" on an iPhone but never got into the app yet →
      // "One step left" until they agree inside the app.
      if (!data && ip) {
        browserClient().rpc('my_beta_lab').then(({ data: lab }) => {
          if (lab && !lab.agreed_at) setRemind(true);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  async function answer(yes) {
    setBusy(true);
    try {
      await browserClient().rpc('beta_respond_invite', { p_accept: yes });
      if (yes) { router.push('/beta'); return; }
      setShow(false); setDeclined(true);
    } finally { setBusy(false); }
  }

  if (remind) return (
    <div className="bl-card bl-remind" role="region" aria-label="Finish getting the app">
      <div className="bl-remind-top">
        <span className="ga-ic ga-rb" style={{ width: 46, height: 46, fontSize: 19 }} aria-hidden="true">rb</span>
        <div><small>Almost there</small><b>One step left to get the new app</b></div>
      </div>
      <div className="ga-bar" style={{ marginBottom: 12 }} aria-label="Halfway"><span className="on" /><span /></div>
      <button type="button" className="bl-go" style={{ width: '100%' }} onClick={() => router.push('/beta')}>Finish getting the app</button>
      <p className="bl-small" style={{ margin: '10px 0 0', textAlign: 'center' }}>This goes away once the app is open on your phone.</p>
    </div>
  );
  if (declined) return <div className="bl-card bl-invite"><p style={{ margin: 0 }}>No problem at all. Thanks for being here.</p></div>;
  if (!show) return null;

  return (
    <div className="bl-inv2" role="region" aria-label="Beta invite">
      <div className="bl-inv2-in">
        <span className="bl-badge">🔒 Private beta · Invite only</span>
        <div>
          <h3>{iphone ? <>You&rsquo;re invited to try our new iPhone app first.</> : <>You&rsquo;re invited to help shape <BrandName /></>}</h3>
          <p>A small group of members gets it before anyone else. Your honest take shapes what everyone gets.</p>
        </div>
        <div className="bl-facts">
          <div className="bl-fact"><i aria-hidden="true">⏱</i>4 to 6 weeks</div>
          <div className="bl-fact"><i aria-hidden="true">✓</i>A few optional 5-minute missions a week</div>
          <div className="bl-fact"><i aria-hidden="true">🛡</i>Your words are never tracked. Leave any time.</div>
        </div>
        <div>
          <button type="button" className="bl-go" disabled={busy} onClick={() => answer(true)}>I&rsquo;m in</button>
          <div style={{ textAlign: 'center' }}>
            <button type="button" className="bl-quiet" disabled={busy} onClick={() => answer(false)}>No thanks</button>
          </div>
        </div>
      </div>
    </div>
  );
}
