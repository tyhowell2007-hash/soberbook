import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   TAKING SOMETHING DOWN OFF THE WALL.

   Ty took Joe Rogan and Kratom Real Talk on auto-pull knowing the risk:
   whatever those channels upload next lands on the wall unreviewed. This
   route is the thing that makes that decision safe to live with — and
   until now it didn't exist, which made the risk theoretical rather than
   managed.

   ⭐ Sixth time this month something was fully built with no way in: the
   database has had `hidden_at` and `active` since 0057. The kill switch
   existed; the switch had no handle.

   ---------------------------------------------------------------------
   TWO SCOPES, AND THE DIFFERENCE MATTERS.

     item   — this one video was bad. The source stays.
     source — this CHANNEL is wrong for here. Everything it ever brought
              in disappears at once, and nothing new arrives.

   ⚠️ Neither DELETES anything. Hiding is reversible and leaves a record
   of what was shown and when — which matters if there is ever a reason
   to answer for it. A delete would erase the evidence along with the
   problem.

   ---------------------------------------------------------------------
   🔴 WHY THIS IS A SERVER ROUTE AND NOT A CLIENT UPDATE.

   0057 gave `authenticated` no grant at all on content_items or
   content_sources — members are refused with 42501 before RLS is even
   consulted. That's deliberate and stronger than a policy.

   So the write happens here with the service role, and the admin check is
   in this file. ⚠️ The temptation when this returned "permission denied"
   would have been to grant the table. Don't. That note is in 0057 too.
   ===================================================================== */

export async function POST(req) {
  /* Ty only. ⚠️ 404, not 403 — same as /admin and the sweeper. A 403
     confirms the route exists to anyone who guesses the URL. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return new NextResponse('Not found', { status: 404 });

  let body = null;
  try { body = await req.json(); } catch { body = null; }

  const id    = typeof body?.id === 'string' ? body.id : null;
  const scope = body?.scope === 'source' ? 'source' : 'item';
  if (!id) return NextResponse.json({ error: 'Nothing named.' }, { status: 400 });

  const admin = adminClient();

  if (scope === 'item') {
    const { error } = await admin
      .from('content_items')
      .update({ hidden_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, scope: 'item' });
  }

  /* Switching a source off hides everything it ever brought in, because
     feed_content joins through `active`. ⚠️ The items are left alone —
     turning the source back on restores them, and that reversibility is
     the point. */
  const { data: src, error } = await admin
    .from('content_sources')
    .update({ active: false })
    .eq('id', id)
    .select('label')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scope: 'source', label: src?.label || null });
}
