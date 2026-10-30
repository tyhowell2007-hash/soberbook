import { NextResponse } from 'next/server';
import { adminClient, adminConfigured } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   URGENT-REPORT ALERTS  (0194, 30 Oct 2026).

   The database calls this the instant a report is filed (report_alert
   trigger → pg_net), with the report id and nothing else. This route:

     1. decides whether the report is URGENT,
     2. stamps Sage's label on it for the queue,
     3. buzzes every admin's phone.

   ---------------------------------------------------------------------
   🔴 AI SORTS. A PERSON DECIDES.

   Sage never removes, suspends or messages anybody. It picks one label
   from a fixed list, the same "returns an id, never prose" rule as the
   help desk (app/api/sage/help). Not one word the model writes is shown to
   anyone, including Ty.

   🔴 DANGER IS CHECKED HERE FIRST, NEVER BY THE MODEL. A "worried about
   them" report, or words like suicide or overdose, are urgent before any
   network call is made. A model outage, a timeout or an empty credit
   balance can make an urgent report look routine — it can never make a
   danger report look safe, because the model is not asked about those.

   🔴 SAGE ONLY READS POSTS AND REPLIES. The privacy page promises it never
   sees messages, so a reported room message or profile gets the local
   danger check and nothing else. What goes to Anthropic is the reported
   words and nothing else: no handle, no id, no account.
   ===================================================================== */

/* Same list as the help desk, kept in step by hand. Leading boundary only
   (see the note there: "\bsuicid\b" cannot match inside "suicide"). */
const DANGER = new RegExp(
  '\\b(kill (myself|me)|end (it|my life)|take my own life|wants? to die'
  + '|wanna die|better off (dead|without me)|hurt myself|harm myself|cut myself'
  + '|not worth living|no reason to live|can.?t do this anymore|goodbye everyone)\\b'
  + '|\\b(suicid|overdos|self.?harm)',
  'i',
);

const LABELS = ['danger', 'threat', 'selling', 'harassment', 'routine'];
const URGENT = new Set(['danger', 'threat']);

const SYSTEM =
  'A member of a recovery community reported the text below. Reply with ONE word '
  + 'from this list and nothing else:\n'
  + 'danger: the writer may be at risk of harming themselves or of overdose\n'
  + 'threat: threatens to hurt somebody else\n'
  + 'selling: offers drugs, alcohol or pills, or asks to buy them\n'
  + 'harassment: attacks, shames or targets another member\n'
  + 'routine: anything else\n'
  + 'If unsure between danger and anything else, reply danger.';

async function askSage(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !text) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key,
                 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        temperature: 0,
        system: SYSTEM,
        messages: [{ role: 'user', content: text.slice(0, 2000) }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const word = String(j?.content?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    /* ⚠️ Anything not on the list is thrown away, not shown. */
    return LABELS.includes(word) ? word : null;
  } catch { return null; }
}

/* The same push the reply notifications use, aimed at the admins.
   ⚠️ The payload is a PATH ONLY. The words on the lock screen are constants
   in public/sw.js, chosen by that path, so no report text can ever reach a
   lock screen. */
async function buzzAdmins(admin, to) {
  const { data: mods } = await admin.from('profiles').select('id').eq('is_admin', true);
  const ids = (mods || []).map((m) => m.id);
  if (!ids.length) return 0;
  const { data: subs } = await admin.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failures').in('user_id', ids);
  if (!subs?.length) return 0;

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:ty.howell2007@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const payload = JSON.stringify({ to });
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      ok++;
    } catch (e) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
  return ok;
}

export async function POST(req) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  const admin = adminClient();

  /* Same shared secret as /api/push/send. 404, not 401: an outsider learns
     nothing about whether this route exists. */
  const { data: cfg } = await admin.from('push_config').select('secret').eq('id', 1).maybeSingle();
  if (!cfg?.secret || (req.headers.get('x-push-secret') || '') !== cfg.secret) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let id;
  try { ({ id } = await req.json()); } catch { id = null; }
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 });

  /* 🔴 CLAIM FIRST. Only the call that stamps alerted_at goes on, so a
     retried ping can never buzz Ty twice for one report. */
  const { data: claimed } = await admin.from('reports')
    .update({ alerted_at: new Date().toISOString() })
    .eq('id', id).is('alerted_at', null)
    .select('id, kind, reason, target_type, target_id').maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, skipped: 'already handled' });

  const table = { post: 'posts', comment: 'comments', room_message: 'room_messages' }[claimed.target_type];
  let body = '';
  if (table) {
    const { data } = await admin.from(table).select('body').eq('id', claimed.target_id).maybeSingle();
    body = data?.body || '';
  }
  const text = [body, claimed.reason].filter(Boolean).join('\n');

  let label = null;
  if (claimed.kind === 'concern' || DANGER.test(text)) {
    label = 'danger';
  } else if (claimed.target_type === 'post' || claimed.target_type === 'comment') {
    label = await askSage(text);
  }
  const urgent = URGENT.has(label);

  await admin.from('reports')
    .update({ urgent, sage_label: label, sage_at: new Date().toISOString() })
    .eq('id', id);

  const delivered = await buzzAdmins(admin, urgent ? '/admin/urgent' : '/admin');
  return NextResponse.json({ ok: true, urgent, label, delivered });
}
