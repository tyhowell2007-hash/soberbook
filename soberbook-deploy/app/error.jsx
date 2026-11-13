'use client';

import { useEffect, useState } from 'react';
import './tickets.css';

/* =====================================================================
   WHEN A SCREEN CRASHES — 0202, 13 Nov 2026.
   Until now a crash showed Next's bare "Application error" page with no
   way back and no way to say so. This keeps the same first words (the
   sweep's route check looks for them) and adds two ways forward: try
   again, or send a ticket that already knows which screen broke.
   ⚠️ No technical detail is shown to the member. The error's short
   digest goes on the ticket for Ty, nothing else.
   ===================================================================== */
export default function AppError({ error, reset }) {
  const [path, setPath] = useState('');
  useEffect(() => { setPath(window.location.pathname); }, []);
  const q = new URLSearchParams({
    cat: 'load',
    screen: path,
    error: `Screen crashed${error?.digest ? ` (${error.digest})` : ''}`,
  });
  return (
    <div className="pad" style={{ paddingTop: 40 }}>
      <div className="tk-card" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, margin: '4px 0 6px' }}>Application error</h1>
        <p style={{ margin: '0 0 14px' }}>Something went wrong on this screen. It&rsquo;s not you.</p>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <p style={{ margin: '14px 0 0' }}>
          <a className="tk-errlink" href={`/report?${q.toString()}`}>Still broken? Report this problem ›</a>
        </p>
        <p style={{ margin: '10px 0 0' }}><a href="/wall">Back to the wall</a></p>
      </div>
    </div>
  );
}
