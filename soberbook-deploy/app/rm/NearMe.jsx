'use client';

import { useState } from 'react';

/* "Near me": asks the browser once, then searches from that spot.
   ⚠️ The location goes into the search address only as two numbers
   rounded to about a mile (2 decimals), never stored anywhere. */
export default function NearMe({ action, label, extra = '' }) {
  const [msg, setMsg] = useState('');
  const go = () => {
    if (!navigator.geolocation) { setMsg('Your browser can’t share a location. Type a ZIP code instead.'); return; }
    setMsg('…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const near = `${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}`;
        window.location.assign(`${action}?near=${encodeURIComponent(near)}${extra}`);
      },
      () => setMsg('Location is off. Type a ZIP code or town instead.'),
      { maximumAge: 600000, timeout: 10000 }
    );
  };
  return (
    <>
      <button type="button" className="btn ghost sm" onClick={go}>{label}</button>
      {msg && msg !== '…' && <span className="small" role="status" style={{ flexBasis: '100%' }}>{msg}</span>}
    </>
  );
}
