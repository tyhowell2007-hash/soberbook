import { NextResponse } from 'next/server';
import { adminClient } from '../../../../lib/supabase-admin';
import { fetchState, toListing } from '../../../../lib/rm/samhsa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* =====================================================================
   RECOVERYMAP — THE MONTHLY SAMHSA CHECK. 6 Nov 2026 (Kenny).

   vercel.json runs this daily. Each run checks the states whose last
   successful check is 28+ days old, as many as fit in the time limit,
   so every state is checked about once a month. What a check changes is
   described in supabase/rm_samhsa_monthly.sql.

   ⭐ SAFE WITHOUT A SECRET, the same way /api/content/cron is: it is
   RATE-LIMITED BY ITS OWN DATA. A state checked in the last 28 days is
   skipped, so calling this URL more often only does early what the
   daily run would do anyway. Every change is reversible (hide, never
   delete) and logged in rm_samhsa_log.

   🔴 GET with ?dry=1 reads SAMHSA and reports, writing nothing.
   ===================================================================== */

const DAYS = 28;
const BUDGET_MS = 270000;     // stop starting new states after this
const PER_STATE_MS = 120000;  // the most one state may take

export async function GET(req) {
  const t0 = Date.now();
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const admin = adminClient();

  const { data: due, error } = await admin.rpc('rm_samhsa_due', { p_days: DAYS, p_limit: 12 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results = [];
  for (const box of due || []) {
    if (Date.now() - t0 > BUDGET_MS - PER_STATE_MS) break;
    const deadline = Date.now() + PER_STATE_MS;
    try {
      const raw = await fetchState(box.state, box, deadline);
      const rows = raw.map(toListing);
      if (dry) {
        results.push({ state: box.state, facilities: rows.length, excluded: rows.filter((r) => r.excluded).length, dry: true });
        continue;
      }
      const { data, error: e2 } = await admin.rpc('rm_samhsa_apply', { p_state: box.state, p_rows: rows });
      if (e2) throw e2;
      results.push(data);
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 300);
      /* Recorded as a failed run, so the state stays due and is retried
         tomorrow. Nothing in centers changes. */
      if (!dry) await admin.from('rm_samhsa_runs').insert({ state: box.state, error: `Could not read SAMHSA: ${msg}` });
      results.push({ state: box.state, error: msg });
    }
  }

  return NextResponse.json({
    ok: true, dry, checked: results.length,
    remaining_due: Math.max(0, (due || []).length - results.length),
    seconds: Math.round((Date.now() - t0) / 1000),
    results,
  });
}
