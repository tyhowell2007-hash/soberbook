import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';
import { sendMail } from '../../../../lib/mail';
import { tourEmail, TOUR_BROADCAST_KEY } from '../../../../lib/broadcast-tour';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* =====================================================================
   THE SEND BUTTON'S ENGINE — owner only.

   ⭐ WHY THIS EXISTS AT ALL, RATHER THAN ME SENDING FROM A SCRIPT.
   The Resend key lives in Vercel's environment. Sending from outside
   would mean pasting it into a chat window, where it would sit in a
   transcript forever. A route inside the app can use the key without
   anybody ever seeing it, and Ty's own login is the authorisation.

   🔴 GET IS A DRY RUN. POST SENDS.
   The content cron learned this the hard way in August: a route whose
   GET does the real thing gets fired by something that only speaks GET,
   and nobody finds out. Here GET only ever reports numbers.

   ⚠️ BATCHED, AND SAFE TO PRESS AGAIN. Resend's free tier is 100 emails
   a day against 146 members. The loop claims each person in the
   database BEFORE sending, so pressing the button tomorrow resumes
   where it stopped and cannot send anybody a second copy — see 0109.
   ===================================================================== */

async function requireOwner() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  /* ⚠️ Read is_admin through the member's OWN session, not the admin
     client. If the session isn't Ty's, RLS returns nothing and this
     fails closed. Asking the service role "is this person an admin"
     would work too and is one typo away from asking it about the wrong
     id. */
  const { data } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  return data?.is_admin ? user : null;
}

/* ---- GET: how far along are we? Sends nothing. ---- */
export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: 'no' }, { status: 404 });
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'admin not configured' }, { status: 500 });
  }
  const { data } = await adminClient().rpc('broadcast_progress', { p_key: TOUR_BROADCAST_KEY });
  const p = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ dryRun: true, key: TOUR_BROADCAST_KEY, ...p });
}

/* ---- POST: actually send, up to `limit` people ---- */
export async function POST(req) {
  const owner = await requireOwner();
  /* ⚠️ 404, not 403 — the /admin convention. "Forbidden" confirms the
     route exists and is worth attacking; "not found" says nothing. */
  if (!owner) return NextResponse.json({ error: 'no' }, { status: 404 });
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'admin not configured' }, { status: 500 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'no RESEND_API_KEY on the server' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  /* ⚠️ Clamped hard. A typo in the browser console cannot turn this
     into "send to everybody, right now, and blow the daily quota". */
  const limit = Math.max(1, Math.min(Number(body.limit) || 25, 100));

  const admin = adminClient();
  const { data: pending, error } = await admin.rpc('broadcast_pending', {
    p_key: TOUR_BROADCAST_KEY, p_limit: limit,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0, failed = 0, skipped = 0;
  const errors = [];

  for (const row of pending || []) {
    /* 🔴 CLAIM FIRST, SEND SECOND. If the function crashes, times out,
       or Ty double-taps, the worst case is somebody gets NO email —
       recoverable, and visible in the numbers. Sending first and
       recording after would make the worst case a SECOND email, which
       is the one thing we promised would never happen. */
    const { data: won } = await admin.rpc('broadcast_claim', {
      p_key: TOUR_BROADCAST_KEY, p_member: row.member_id,
    });
    if (won !== true) { skipped++; continue; }

    const pageUrl = `https://soberbook.app/unsub/${row.optout_token}`;
    const postUrl = `https://soberbook.app/api/unsub/${row.optout_token}`;
    const { subject, html, text } = tourEmail({ optoutUrl: pageUrl });

    const res = await sendMail({
      to: row.email,
      subject, html, text,
      /* ⭐ The real one-click unsubscribe. Gmail and Outlook render a
         button from these headers, and a person who uses it costs us one
         address — where "report spam" costs deliverability for all 146. */
      headers: {
        'List-Unsubscribe': `<${postUrl}>, <${pageUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (res.ok) {
      sent++;
    } else {
      failed++;
      /* ⚠️ The row STAYS. A bad address will be bad tomorrow too, and
         retrying it on every press is how a sending reputation dies.
         It is marked instead, so the count is honest. */
      await admin.rpc('broadcast_failed', {
        p_key: TOUR_BROADCAST_KEY, p_member: row.member_id,
      });
      if (errors.length < 5) errors.push(res.error);
    }
  }

  const { data: prog } = await admin.rpc('broadcast_progress', { p_key: TOUR_BROADCAST_KEY });
  const p = Array.isArray(prog) ? prog[0] : prog;

  /* ⚠️ No addresses in the response, ever. This is a count of people in
     recovery; the browser gets integers and, at most, five error
     strings from Resend. */
  return NextResponse.json({ sent, failed, skipped, errors, ...p });
}
