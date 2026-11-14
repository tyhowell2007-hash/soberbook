'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { browserClient } from '../../lib/supabase-browser';
import BrandName from '../components/BrandName';

/* =====================================================================
   The member's side of a meeting slip (0203) — premium look, 9 Nov 2026.
   1. Show my slip code → a pass with a QR the chair scans with their own
      camera. It opens soberbook.app/sign/<code>; no scanner app needed.
      A live countdown shows how long the code is good for (3 hours).
   2. While the code is up, poll every 4s. When it's signed, the gold
      seal stamps on and the slip drops into the list.
   3. My signed slips as ticket stubs, and ONE private link (a switch).

   🔴 Never the word "verified". A slip says a Sober Book member signed it
   in person — that's all, and the page says so.
   ===================================================================== */
const SITE = 'https://soberbook.app';

function dayParts(d) {
  const [y, m, dd] = String(d).split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  return { mon: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: dd, ym: `${y}-${m}` };
}
function fmtTime(t) {
  return t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
}
function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
const TODAY = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function SlipView() {
  const supa = useRef(browserClient()).current;
  const [name, setName] = useState('');
  const [code, setCode] = useState(null);       // { token, expires, svg, made }
  const [signed, setSigned] = useState(null);   // { by, at }
  const [now, setNow] = useState(Date.now());
  const [slips, setSlips] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [share, setShare] = useState(null);     // { share_id, label } | null
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function loadLists() {
    const [a, b, c] = await Promise.all([
      supa.rpc('my_slips'), supa.rpc('my_slip_share'), supa.rpc('my_meeting_checkins'),
    ]);
    setSlips(a.error ? [] : (a.data || []));
    const s = Array.isArray(b.data) ? b.data[0] : b.data;
    setShare(s || null); if (s?.label) setLabel(s.label);
    const ck = Array.isArray(c.data) ? c.data[0] : c.data;
    if (ck?.today_name) setName((n) => n || ck.today_name);
  }
  useEffect(() => { loadLists(); /* eslint-disable-next-line */ }, []);

  // countdown tick while a code is on screen
  useEffect(() => {
    if (!code || signed) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [code, signed]);

  // poll while a code is on screen
  useEffect(() => {
    if (!code || signed) return;
    const iv = setInterval(async () => {
      const { data } = await supa.rpc('slip_status', { p_token: code.token });
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.signed) { setSigned({ by: r.signer_handle || 'a member', at: new Date() }); setFresh(true); loadLists(); }
      else if (r?.expired) { setCode(null); setErr('That code ran out. Make a new one.'); }
    }, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, [code, signed]);

  async function start() {
    if (busy) return;
    setBusy(true); setErr(''); setSigned(null);
    const { data, error } = await supa.rpc('slip_start', { p_name: name.trim() || null });
    setBusy(false);
    if (error) { setErr('That didn’t go through. Try again in a second.'); return; }
    const r = Array.isArray(data) ? data[0] : data;
    const svg = await QRCode.toString(`${SITE}/sign/${r.token}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M',
      color: { dark: '#060A3C', light: '#FFFFFF' } });
    setNow(Date.now());
    setCode({ token: r.token, expires: r.expires_at, svg, made: new Date() });
  }

  async function shareOn() {
    if (busy) return;
    setBusy(true); setErr('');
    const { data, error } = await supa.rpc('slip_share_on', { p_label: label.trim() || null });
    setBusy(false);
    if (error) { setErr('Couldn’t make the link. Try again in a second.'); return; }
    setShare({ share_id: data, label: label.trim() || null });
  }
  async function shareOff() {
    if (busy) return;
    setBusy(true); setErr('');
    const { error } = await supa.rpc('slip_share_off');
    setBusy(false);
    if (error) { setErr('Couldn’t turn it off. Try again in a second.'); return; }
    setShare(null); setCopied(false);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  }

  const link = share ? `${SITE}/slips/${share.share_id}` : '';
  const thisMonth = (() => {
    const d = new Date(); const ym = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return (slips || []).filter((s) => dayParts(s.slip_day).ym === ym).length;
  })();

  return (
    <div className="sl-wrap">
      {!code && (
        <div className="sl-stack">
          <div>
            <div className="sl-eyebrow">Proof for court, PO or your house</div>
            <h1 className="sl-big">Get a signed meeting slip</h1>
          </div>
          <p className="sl-p">Show your code to the meeting chair. They point their phone camera at it and sign. Takes ten seconds. No location used.</p>
          <div>
            <label className="sl-lab" htmlFor="sl-name">Which meeting</label>
            <input id="sl-name" className="sl-in" type="text" maxLength={80} value={name}
                   placeholder="Tuesday night Big Book" onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="button" className="sl-go" onClick={start} disabled={busy}>
            {busy ? 'Making your code…' : 'Show my slip code'}
          </button>
        </div>
      )}

      {code && (
        <div className="sl-pass">
          <div className="sl-ph"><span className="sl-logo"><BrandName /></span><span className="sl-tag">MEETING SLIP</span></div>
          <div className="sl-pm">
            <b>{name.trim() || 'Meeting'}</b>
            <span>{TODAY()} · {fmtTime(code.made)}</span>
          </div>
          <div className="sl-perf"><i /></div>
          {!signed ? (
            <div className="sl-pq">
              <div className="sl-qr" aria-label="Meeting slip code" role="img" dangerouslySetInnerHTML={{ __html: code.svg }} />
              <div className="sl-timer"><span className="sl-dot" />Waiting for the chair · <span className="t">{fmtLeft(new Date(code.expires).getTime() - now)}</span></div>
            </div>
          ) : (
            <div className="sl-pq" role="status">
              <div className="sl-seal"><div><b>SIGNED</b><span>IN PERSON</span></div></div>
              <div className="sl-signed">Signed by <b>@{signed.by}</b> at {fmtTime(signed.at)}<br />Saved to your slips · counts as today’s check-in</div>
            </div>
          )}
        </div>
      )}
      {code && !signed && <button type="button" className="sl-ghost" onClick={() => setCode(null)}>Cancel</button>}
      {code && signed && <button type="button" className="sl-ghost" onClick={() => { setCode(null); setSigned(null); }}>Done</button>}

      <div className="sl-stats">
        <div className="sl-stat"><b>{slips ? thisMonth : '–'}</b><span>This month</span></div>
        <div className="sl-stat"><b>{slips ? slips.length : '–'}</b><span>Signed in all</span></div>
      </div>

      {slips && slips.length === 0 && <p className="sl-p">No signed slips yet. After your next meeting, show your code to the chair.</p>}
      {slips && slips.length > 0 && (
        <ul className="sl-stubs" aria-label="My signed slips">
          {slips.map((s, i) => {
            const p = dayParts(s.slip_day);
            return (
              <li key={i} className={'sl-stub' + (fresh && i === 0 ? ' new' : '')}>
                <div className="sl-d"><small>{p.mon}</small><b>{p.day}</b></div>
                <div className="sl-m"><b>{s.meeting_name || 'Meeting'}</b><span>{fmtTime(s.signed_at)} · signed by @{s.signer_handle}</span></div>
                <div className="sl-mini" aria-hidden="true">✓</div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="sl-share" aria-label="Share my slips">
        <div className="sl-sw">
          <div>
            <b>Private link for my PO</b>
            <p className="sl-p">Only people with the link can see your slips. Switch it off and the link stops working.</p>
          </div>
          <button type="button" className="sl-toggle" role="switch" aria-checked={!!share}
                  aria-label={share ? 'Private link on' : 'Private link off'} disabled={busy}
                  onClick={() => (share ? shareOff() : shareOn())} />
        </div>
        <div>
          <label className="sl-lab" htmlFor="sl-label">Name on the record <span>(optional)</span></label>
          <input id="sl-label" className="sl-in" type="text" maxLength={60} value={label}
                 placeholder="Your name, as your PO knows you" onChange={(e) => setLabel(e.target.value)} />
        </div>
        {share && (
          <>
            <div className="sl-link">
              <input className="sl-in" readOnly value={link} aria-label="Your private slips link" onFocus={(e) => e.target.select()} />
              <button type="button" className="sl-go" onClick={() => copy(link)}>{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>
            {(label.trim() || null) !== (share.label || null) && (
              <button type="button" className="sl-ghost" onClick={shareOn} disabled={busy}>Save the name</button>
            )}
          </>
        )}
      </section>

      <p className="sl-fine">A meeting slip shows a <BrandName /> member signed in person at that meeting. <BrandName /> doesn’t check who the chair is, and a slip isn’t a court document. Ask your PO or program if they accept it.</p>
      {err && <p className="sl-err" role="alert">{err}</p>}
    </div>
  );
}
