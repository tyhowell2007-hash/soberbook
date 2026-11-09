'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { myProgram } from '../../lib/program';

/* =====================================================================
   988 AT THE TOP OF MORE — 9 Nov 2026.

   This row lived at the top of the ☰ drawer (MastMenu) because of the
   29 Oct CRCC ask: 988 on the main screens. The drawer is gone (it listed
   the same things as the More tab), so the row moved here, first thing.

   ⭐ The Illinois Helpline line now shows to members in the Illinois
   program (program_members, lib/program.js), and 988 shows to everybody.
   Everyone else was being shown a state line for a state most of them
   don't live in. ⚠️ If CRCC's contract needs it shown to all members,
   set ALWAYS_IL to true.
   ===================================================================== */
const ALWAYS_IL = false;

export default function CrisisRow() {
  const [il, setIl] = useState(ALWAYS_IL);
  useEffect(() => {
    if (ALWAYS_IL) return;
    let alive = true;
    myProgram(browserClient()).then((p) => { if (alive) setIl(p === 'illinois'); });
    return () => { alive = false; };
  }, []);
  return (
    <a className="mm-crisis" href="tel:988" style={{ display: 'block', marginBottom: 12 }}>
      Need someone right now? Call or text 988
      {il && <span className="mm-crisis-s">Illinois Helpline: 833-234-6343 · text HELP to 833234</span>}
    </a>
  );
}
