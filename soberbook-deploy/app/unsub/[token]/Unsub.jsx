'use client';

import { useState } from 'react';

/* =====================================================================
   The button. One tap, no sign-in, no account needed.

   ⚠️ Optimistic would be wrong here, and for the same reason blocking is
   not optimistic (19 Aug): somebody switching off email in a shared
   inbox needs to know it actually happened, not that it appeared to.
   So it waits for the answer.
   ===================================================================== */

const GREEN = '#1B6B4A';
const LINE = '#DCE7E1';

export default function Unsub({ token }) {
  const [state, setState] = useState('ask'); // ask | busy | done | failed

  async function turnOff() {
    setState('busy');
    try {
      const res = await fetch(`/api/unsub/${token}`, { method: 'POST' });
      setState(res.ok ? 'done' : 'failed');
    } catch {
      setState('failed');
    }
  }

  if (state === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '19px', color: '#0F3D2A', fontWeight: 600, margin: '0 0 12px' }}>
          Done. No more emails.
        </p>
        {/* ⚠️ Says plainly that nothing else changed. Somebody turning off
            email may reasonably fear they have just deleted something, or
            left, or been removed from the room. */}
        <p style={{ fontSize: '14px', color: '#63716A', lineHeight: 1.7, margin: 0 }}>
          Your account is untouched and nothing else has changed. Replies and
          messages are still waiting for you inside Sober Book whenever you
          open it. You can switch these back on any time from your own page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '19px', color: '#0F3D2A', fontWeight: 600, margin: '0 0 12px' }}>
        Turn off email notifications?
      </p>
      <p style={{ fontSize: '14px', color: '#1C2320', lineHeight: 1.7, margin: '0 0 22px' }}>
        We&rsquo;ll stop emailing you when somebody answers you or sends you a
        message. You&rsquo;ll still see everything inside the app.
      </p>

      <button
        type="button"
        onClick={turnOff}
        disabled={state === 'busy'}
        style={{
          width: '100%',
          background: GREEN,
          color: '#fff',
          border: 0,
          borderRadius: '10px',
          padding: '14px 0',
          fontSize: '15px',
          fontWeight: 600,
          minHeight: '48px',
          cursor: state === 'busy' ? 'default' : 'pointer',
          opacity: state === 'busy' ? 0.6 : 1,
        }}
      >
        {state === 'busy' ? 'One second…' : 'Yes, turn them off'}
      </button>

      {state === 'failed' && (
        <p style={{ fontSize: '13px', color: '#8A2F2F', marginTop: '14px', lineHeight: 1.6 }}>
          That didn&rsquo;t go through. Try once more &mdash; or you can switch them
          off yourself on your own page inside Sober Book.
        </p>
      )}

      <p style={{ fontSize: '12.5px', color: '#63716A', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${LINE}`, lineHeight: 1.7 }}>
        Nothing has changed yet. Nothing happens until you press the button.
      </p>
    </div>
  );
}
