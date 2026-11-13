'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CATS, deviceLine, ticketNo } from '../../lib/tickets';

/* =====================================================================
   THE PROBLEM TICKET FORM — 0202, 13 Nov 2026.
   Used in two places:
     · /report         signed in (More → Report a problem, or the link
                       inside an error, which pre-fills cat/screen/error)
     · /support        signed out, for somebody locked out — asks for an
                       email because there is no account to answer.

   🔴 THEY SEE WHAT IS SENT. The automatic details are printed on the
   form above the button. Nothing is collected that isn't shown here, and
   never the message or post they were trying to send.
   ⚠️ No time promise ("fixed in 24 hours"). Same rule as /support.
   ===================================================================== */
export default function ReportForm({ signedOut = false, cat = '', screen = '', error = '' }) {
  const [category, setCategory] = useState(CATS.some((c) => c.id === cat) ? cat : '');
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState(null);
  const [device, setDevice] = useState('');
  const [where, setWhere] = useState(screen);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [num, setNum] = useState(null);

  useEffect(() => {
    setDevice(deviceLine());
    if (!screen && typeof document !== 'undefined' && document.referrer) {
      try {
        const u = new URL(document.referrer);
        if (u.origin === window.location.origin && u.pathname !== '/report') setWhere(u.pathname);
      } catch { /* leave it blank */ }
    }
  }, [screen]);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    if (!category) { setErr('Pick what’s going wrong.'); return; }
    if (desc.trim().length < 3) { setErr('Tell us a little about what happened.'); return; }
    if (signedOut && !email.trim()) { setErr('Add an email so we can answer you.'); return; }
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.set('category', category);
    fd.set('description', desc.trim());
    fd.set('screen', signedOut ? 'Signed out (Support page)' : where);
    fd.set('device', device);
    fd.set('error', error);
    fd.set('website', e.target.website?.value || '');
    if (signedOut) fd.set('email', email.trim());
    if (shot) fd.set('shot', shot);
    try {
      const r = await fetch('/api/ticket', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Couldn’t send that. Try again.'); setBusy(false); return; }
      setNum(j.num || 0);
    } catch {
      setErr('Couldn’t send that. Check your signal and try again.');
    }
    setBusy(false);
  }

  if (num !== null) {
    return (
      <div className="tk-done">
        <div className="tk-tick" aria-hidden="true">✓</div>
        {num > 0 && <div className="tk-num">{ticketNo(num)}</div>}
        <p className="tk-got">Got it. Ty and Kenny have it now.</p>
        <p className="tk-soft">
          {signedOut
            ? 'We’ll answer you by email.'
            : 'You’ll get an alert when we reply or fix it. You can check on it any time in My tickets.'}
        </p>
        {!signedOut && <Link href="/tickets" className="btn">My tickets</Link>}
      </div>
    );
  }

  return (
    <form className="tk-form" onSubmit={send}>
      <h2 className="tk-h">What&rsquo;s going wrong?</h2>
      <div className="tk-chips" role="radiogroup" aria-label="What’s going wrong">
        {CATS.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={category === c.id}
                  className={'tk-chip' + (category === c.id ? ' on' : '')}
                  onClick={() => setCategory(c.id)}>{c.label}</button>
        ))}
      </div>

      <label className="tk-lbl" htmlFor="tk-desc">What happened?</label>
      <textarea id="tk-desc" className="tk-ta" rows={4} maxLength={2000} value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What you tapped, what you expected, and what happened instead." />

      {signedOut && (
        <>
          <label className="tk-lbl" htmlFor="tk-email">Your email, so we can answer</label>
          <input id="tk-email" className="tk-in" type="email" autoComplete="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </>
      )}

      <label className="tk-lbl" htmlFor="tk-shot">Picture (optional)</label>
      <label className="tk-shot">
        <input id="tk-shot" type="file" accept="image/*"
               onChange={(e) => setShot(e.target.files?.[0] || null)} />
        <span>{shot ? `📷 ${shot.name}` : '📷 Add a screenshot'}</span>
      </label>

      {/* Hidden from people. A bot that fills it in is quietly ignored. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="tk-hp" aria-hidden="true" />

      <div className="tk-lbl">Sent with it automatically</div>
      <div className="tk-auto">
        {!signedOut && where && <><b>Screen:</b> {where} · </>}
        {device && <><b>Phone:</b> {device} · </>}
        {error && <><b>Error:</b> {error} · </>}
        <b>Time:</b> now
        <br />Never your messages or posts.
      </div>

      {err && <div className="err">{err}</div>}
      <button type="submit" className="btn tk-send" disabled={busy}>
        {busy ? 'Sending…' : 'Send ticket'}
      </button>
    </form>
  );
}
