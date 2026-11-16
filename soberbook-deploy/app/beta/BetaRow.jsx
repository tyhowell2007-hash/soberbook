'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import { isPhone } from '../../lib/is-phone';

/* The way into Beta Lab from More. Only testers see it: my_beta_status()
   answers null for everyone else, and then this renders nothing. */
export default function BetaRow() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!isPhone()) return;          // phones only (Ty, 15 Nov)
    browserClient().rpc('my_beta_status').then(({ data }) => setOn(!!data)).catch(() => {});
  }, []);
  if (!on) return null;
  return (
    <section className="mo-grp">
      <h2 className="mm-grp" style={{ padding: '14px 2px 4px' }}>Beta</h2>
      <div className="mo-card">
        <Link href="/beta" className="mm-row mo-row">
          <span className="mm-rt">🧪 Beta Lab</span>
          <span className="mm-rs">This week&rsquo;s missions and quick check-ins</span>
        </Link>
      </div>
    </section>
  );
}
