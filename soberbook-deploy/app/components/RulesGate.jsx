'use client';

/* =====================================================================
   THE RULES GATE — 11 Nov 2026. Apple Guideline 1.2.

   Apple's beta review asked that every user agree to terms making clear
   there is zero tolerance for objectionable content and abusive users.
   New members agree on the sign-up form. Everyone who joined before that
   sees this card ONCE, the next time they open the app, and can't use
   Sober Book behind it until they agree.

   ⭐ IT FAILS QUIET. rules_agreed() returns null for a signed-out visitor
   or somebody who hasn't finished first run, and errors for anon — in all
   of those cases the card does not appear. It only ever shows when the
   database positively says "this member has not agreed".

   ⚠️ The pages a person must be able to READ before agreeing — the Rules
   themselves, privacy, help, deleting an account — never show it.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import '../rules-agree.css';
import BrandName from './BrandName';

const OPEN = ['/login', '/rules', '/privacy', '/support', '/help', '/delete-account', '/reset', '/unsub', '/rm'];

export default function RulesGate() {
  const path = usePathname() || '/';
  const [need, setNeed] = useState(false);
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const skip = OPEN.some((p) => path === p || path.startsWith(p + '/'));

  useEffect(() => {
    if (skip) return;
    let live = true;
    (async () => {
      try {
        const { data, error } = await browserClient().rpc('rules_agreed');
        if (live && !error && data === false) setNeed(true);
      } catch { /* quiet by design */ }
    })();
    return () => { live = false; };
  }, [path, skip]);

  async function agree() {
    if (!tick) return;
    setBusy(true); setErr('');
    try {
      const { error } = await browserClient().rpc('agree_to_rules');
      if (error) throw error;
      setNeed(false);
    } catch (e) {
      setErr('That didn’t save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!need || skip) return null;

  return (
    <div className="rg-wrap" role="dialog" aria-modal="true" aria-labelledby="rg-h">
      <div className="rg-card">
        <div className="rg-bar"><BrandName /></div>
        <div className="rg-body">
          <h2 id="rg-h">One thing before you go on</h2>
          <p><BrandName /> only works if everyone here is safe. So we&apos;re asking every member to agree to the Rules:</p>
          <ul>
            <li>Zero tolerance for abuse, harassment, threats, hate, or sexual or objectionable content.</li>
            <li>Every report is reviewed within 24 hours. Content that breaks the Rules comes down, and the account that posted it is removed.</li>
            <li>You can report, block or hide anything from the <b>⋯</b> menu.</li>
          </ul>
          <label className={'ra-box' + (tick ? ' on' : '')}>
            <input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} />
            <span>
              <b>I agree to the <BrandName /> Rules</b>
              <small><a href="/rules" target="_blank" rel="noopener noreferrer">Read the full Rules</a></small>
            </span>
          </label>
          <button className="rg-go" type="button" disabled={!tick || busy} onClick={agree}>
            {busy ? 'One second…' : 'I agree'}
          </button>
          {err && <p className="rg-err" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  );
}
