'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* The chair's side, premium look (9 Nov 2026). Press and hold to sign so
   nobody signs by accident; a gold seal when it's done.
   🔴 Shows the meeting and the day — never who the slip belongs to. */
function fmtDay(d) {
  if (!d) return 'Today';
  const [y, m, dd] = String(d).split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const WORDS = {
  missing: 'This code doesn’t work. Ask them to make a new one.',
  expired: 'This code ran out. Ask them to make a new one.',
  signed: 'This slip is already signed.',
  yours: 'This is your own slip code. The meeting chair signs it, not you.',
};
const HOLD_MS = 1000;

export default function SignView({ token }) {
  const supa = useRef(browserClient()).current;
  const [peek, setPeek] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | done | <status>
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fill, setFill] = useState(0);            // 0–100
  const timer = useRef(null);
  const fillRef = useRef(0);

  useEffect(() => {
    supa.rpc('slip_peek', { p_token: token }).then(({ data, error }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (error || !r) { setState('missing'); return; }
      setPeek(r); setState(r.status);
    });
    return () => clearInterval(timer.current);
    // eslint-disable-next-line
  }, [token]);

  function setF(v) { fillRef.current = v; setFill(v); }

  async function sign() {
    if (busy) return;
    setBusy(true); setErr('');
    const { data, error } = await supa.rpc('slip_sign', { p_token: token });
    setBusy(false);
    if (error) {
      setF(0);
      setErr(error.message?.includes('handle') ? 'Set a handle on your profile first, then sign.' : 'That didn’t go through. Try again.');
      return;
    }
    if (data === 'ok') setState('done'); else setState(data || 'missing');
  }

  function press(e) {
    if (e) e.preventDefault();
    if (busy) return;
    clearInterval(timer.current);
    const step = 100 / (HOLD_MS / 40);
    timer.current = setInterval(() => {
      const v = Math.min(100, fillRef.current + step);
      setF(v);
      if (v >= 100) { clearInterval(timer.current); sign(); }
    }, 40);
  }
  function release() {
    if (busy || fillRef.current >= 100) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const v = Math.max(0, fillRef.current - 8);
      setF(v);
      if (v <= 0) clearInterval(timer.current);
    }, 30);
  }

  return (
    <div className="sl-wrap">
      {state === 'loading' && <p className="sl-p">One second…</p>}

      {state === 'ready' && (
        <div className="sl-stack">
          <div><div className="sl-eyebrow">You’re signing</div><h1 className="sl-big">A meeting slip</h1></div>
          <div className="sl-pass">
            <div className="sl-ph"><span className="sl-logo">Sober Book</span><span className="sl-tag">MEETING SLIP</span></div>
            <div className="sl-pm"><b>{peek?.meeting_name || 'A meeting'}</b><span>{fmtDay(peek?.slip_day)}</span></div>
          </div>
          <div className="sl-priv"><span aria-hidden="true">🔒</span><span>You won’t see who this belongs to. Only sign if they were at your meeting. Your <b>@handle</b> goes on their slip, and they may show it to a PO or program.</span></div>
          <button type="button" className={'sl-hold' + (fill > 55 ? ' full' : '')} disabled={busy}
                  onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); }}
                  onKeyUp={release}>
            <i style={{ width: fill + '%' }} />
            <span>{busy ? 'Signing…' : fill > 0 ? 'Keep holding…' : 'Press and hold to sign'}</span>
          </button>
        </div>
      )}

      {state === 'done' && (
        <div className="sl-done" role="status">
          <div className="sl-seal"><div><b>SIGNED</b><span>THANK YOU</span></div></div>
          <h1 className="sl-big">Signed.</h1>
          <p className="sl-p">It just showed up on their phone. Thanks for carrying the message.</p>
          <Link href="/meetings" className="sl-ghost">← Back to meetings</Link>
        </div>
      )}

      {WORDS[state] && (
        <div className="sl-stack">
          <div><div className="sl-eyebrow">Meeting slip</div><h1 className="sl-big">Can’t sign this one</h1></div>
          <p className="sl-p">{WORDS[state]}</p>
          <Link href="/meetings" className="sl-ghost">← Back to meetings</Link>
        </div>
      )}
      {err && <p className="sl-err" role="alert">{err}</p>}
    </div>
  );
}
