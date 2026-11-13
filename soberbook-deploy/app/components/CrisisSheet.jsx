'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { myProgram } from '../../lib/program';

/* =====================================================================
   "YOU'RE NOT ALONE TONIGHT" — 0201, 13 Nov 2026.
   Prototype approved by Ty: claude.ai/artifact/APNJjjvmVugEWernHutYnu

   When somebody's own words read like a crisis, the database (crisis_flag)
   lets the post, reply or message go up as normal, leaves a card waiting
   for the WRITER, and alerts Ty and Kenny. This shows that card.

   🔴 ONLY THE WRITER EVER SEES IT. take_support_prompt() reads the
      signed-in member's own row and nothing else.
   🔴 IT NEVER BLOCKS ANYTHING. The post is already up by the time this
      appears. "I'm okay for now" just closes it.

   HOW IT KNOWS WHEN TO LOOK, without touching Wall.jsx or Convo.jsx:
   lib/supabase-browser.js fires a 'sb:wrote' event whenever a post, reply
   or message is saved. We check then, on first load, and when the app
   comes back to the front (a room message saves through the server, so
   that one shows the next time they open the app).
   ===================================================================== */
export default function CrisisSheet() {
  const [open, setOpen] = useState(false);
  const [il, setIl] = useState(false);
  const checking = useRef(false);

  useEffect(() => {
    let alive = true;
    async function check() {
      if (checking.current) return;
      checking.current = true;
      try {
        const supabase = browserClient();
        const { data } = await supabase.rpc('take_support_prompt');
        if (alive && data === true) {
          setOpen(true);
          myProgram(supabase).then((p) => { if (alive) setIl(p === 'illinois'); }).catch(() => {});
        }
      } catch { /* say nothing rather than guess */ }
      finally { checking.current = false; }
    }
    const onWrote = () => setTimeout(check, 900);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('sb:wrote', onWrote);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.removeEventListener('sb:wrote', onWrote);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="cs-wrap" role="dialog" aria-modal="true" aria-labelledby="cs-h">
      <div className="cs-dim" onClick={() => setOpen(false)} />
      <div className="cs-sheet">
        <h2 id="cs-h" className="cs-h">You&rsquo;re not alone tonight</h2>
        <p className="cs-p">
          What you wrote is up and people here will see it. If you want to talk to
          someone right now, these are free, private and open all night.
        </p>

        <a className="cs-num" href="tel:988">
          <b>988</b>
          <span>Call or text · Suicide &amp; Crisis Lifeline</span>
        </a>
        <a className="cs-num" href="sms:741741&body=HOME">
          <b>Text HOME to 741741</b>
          <span>Crisis Text Line</span>
        </a>
        {il && (
          <a className="cs-num" href="tel:8332346343">
            <b>833-234-6343</b>
            <span>Illinois Helpline · or text HELP to 833234</span>
          </a>
        )}

        <a className="cs-btn cs-go" href="/meetings">Find a meeting starting now</a>
        <button type="button" className="cs-btn cs-ok" onClick={() => setOpen(false)}>
          I&rsquo;m okay for now
        </button>
      </div>
    </div>
  );
}
