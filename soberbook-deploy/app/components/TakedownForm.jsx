'use client';

import { useState } from 'react';

/* 0204 — "Take down an image of me" (TAKE IT DOWN Act). On /support, open
   to anyone. See app/api/takedown/route.js. */
export default function TakedownForm() {
  const [where, setWhere] = useState('');
  const [isPerson, setIsPerson] = useState(false);
  const [noConsent, setNoConsent] = useState(false);
  const [signature, setSignature] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/takedown', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ where, isPerson, noConsent, signature, email, website: e.target.website?.value || '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Couldn’t send that. Try again.'); setBusy(false); return; }
      setDone(true);
    } catch { setErr('Couldn’t send that. Check your signal and try again.'); }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="tk-done">
        <div className="tk-tick" aria-hidden="true">✓</div>
        <p className="tk-got">We got your request.</p>
        <p className="tk-soft">We act within 48 hours and will email you when it’s done.</p>
      </div>
    );
  }
  return (
    <form className="tk-form" onSubmit={send}>
      <h2 className="tk-h">Take down an image of me</h2>
      <label className="tk-lbl" htmlFor="td-where">Where is it?</label>
      <textarea id="td-where" className="tk-ta" rows={3} maxLength={1000} value={where} onChange={(e) => setWhere(e.target.value)}
                placeholder="A link to the post, or describe where you saw it" />
      <label className="tk-lbl" style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 'normal', fontSize: 14, fontWeight: 600 }}>
        <input type="checkbox" checked={isPerson} onChange={(e) => setIsPerson(e.target.checked)} />
        I&rsquo;m the person shown, or I&rsquo;m acting for them
      </label>
      <label className="tk-lbl" style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 'normal', fontSize: 14, fontWeight: 600 }}>
        <input type="checkbox" checked={noConsent} onChange={(e) => setNoConsent(e.target.checked)} />
        I didn&rsquo;t agree to this image being shared
      </label>
      <label className="tk-lbl" htmlFor="td-sig">Your full name (your signature)</label>
      <input id="td-sig" className="tk-in" value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" />
      <label className="tk-lbl" htmlFor="td-email">Email so we can tell you it&rsquo;s done</label>
      <input id="td-email" className="tk-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="tk-hp" aria-hidden="true" />
      {err && <div className="err">{err}</div>}
      <button type="submit" className="btn tk-send" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
      <p className="tk-foot">We remove it within 48 hours. You don&rsquo;t need an account.</p>
    </form>
  );
}
