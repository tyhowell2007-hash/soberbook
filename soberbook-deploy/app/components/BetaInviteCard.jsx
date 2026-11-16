'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import BrandName from './BrandName';
import { isPhone } from '../../lib/is-phone';
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

  useEffect(() => {
    if (!isPhone()) return;          // phones only (Ty, 15 Nov)
    browserClient().rpc('my_beta_invite').then(({ data }) => setShow(!!data)).catch(() => {});
  }, []);

  async function answer(yes) {
    setBusy(true);
    try {
      await browserClient().rpc('beta_respond_invite', { p_accept: yes });
      if (yes) { router.push('/beta'); return; }
      setShow(false); setDeclined(true);
    } finally { setBusy(false); }
  }

  if (declined) return <div className="bl-card bl-invite"><p style={{ margin: 0 }}>No problem at all. Thanks for being here.</p></div>;
  if (!show) return null;

  return (
    <div className="bl-card bl-invite" role="region" aria-label="Beta invite">
      <span className="bl-tag">Just for you</span>
      <h3>You&rsquo;re invited to help shape <BrandName /></h3>
      <p>
        You&rsquo;ve been part of this community, and we&rsquo;d love your honest take on where the app goes next.
        We&rsquo;re asking a small group of members to try new things, answer a few short questions, and tell us
        what&rsquo;s working and what isn&rsquo;t.
      </p>
      <p>About 4 to 6 weeks. A few optional 5-minute missions a week, quick surveys under a minute. Leave any time.</p>
      <div className="bl-btns">
        <button type="button" className="bl-go" disabled={busy} onClick={() => answer(true)}>I&rsquo;m in</button>
        <button type="button" className="bl-no" disabled={busy} onClick={() => answer(false)}>No thanks</button>
      </div>
    </div>
  );
}
