import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';
import Board from './Board';
import '../../tickets.css';

export const dynamic = 'force-dynamic';

/* =====================================================================
   /admin/tickets — THE PROBLEM TICKET BOARD. 0202, 13 Nov 2026.
   Ty and Kenny only (404 for everyone else, like /admin).

   Read with the service role AFTER the is_admin check: tickets have no
   member grants at all. Shows the handle of a signed-in reporter so you
   can follow up, the email of a signed-out one, the screen, the phone,
   the error, and the screenshot.

   ⭐ "3 people": tickets with the same category and screen within six
   hours of each other count as one problem, so the size of a breakage is
   visible at a glance. Mark one fixed and they all close.
   ===================================================================== */
export default async function TicketsBoard() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: mod } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin || !adminConfigured()) notFound();

  const admin = adminClient();
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const { data: rows } = await admin.from('tickets').select('*')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(300);
  const tickets = rows || [];

  const ids = [...new Set(tickets.flatMap((t) => [t.user_id, t.owner_id]).filter(Boolean))];
  const people = {};
  if (ids.length) {
    const { data } = await admin.from('profiles').select('id, handle, display_name').in('id', ids);
    (data || []).forEach((p) => { people[p.id] = p; });
  }
  const tIds = tickets.map((t) => t.id);
  const replies = {};
  if (tIds.length) {
    const { data } = await admin.from('ticket_replies').select('ticket_id, author_id, body, created_at')
      .in('ticket_id', tIds).order('created_at');
    (data || []).forEach((r) => { (replies[r.ticket_id] ||= []).push(r); });
  }
  const shots = {};
  const paths = tickets.map((t) => t.shot_path).filter(Boolean);
  if (paths.length) {
    const { data } = await admin.storage.from('ticket-shots').createSignedUrls(paths, 3600);
    (data || []).forEach((r) => { if (r.signedUrl) shots[r.path] = r.signedUrl; });
  }

  const SIX = 6 * 36e5;
  const name = (id) => {
    const p = people[id];
    if (!p) return null;
    return (p.display_name || '').trim().split(' ')[0] || (p.handle === 'Tyhowell07' ? 'Ty' : p.handle);
  };
  const list = tickets.map((t) => ({
    id: t.id, num: t.num, category: t.category, description: t.description,
    screen: t.screen, device: t.device, error_text: t.error_text, status: t.status,
    created_at: t.created_at, fixed_at: t.fixed_at,
    who: t.user_id ? (people[t.user_id] ? '@' + people[t.user_id].handle : 'a member') : t.contact_email,
    signed_out: !t.user_id,
    owner: t.owner_id ? name(t.owner_id) : null,
    shot: t.shot_path ? shots[t.shot_path] || null : null,
    same: tickets.filter((x) => x.id !== t.id && x.category === t.category && (x.screen || '') === (t.screen || '')
      && Math.abs(new Date(x.created_at) - new Date(t.created_at)) <= SIX
      && ['new', 'working'].includes(x.status)).length,
    replies: (replies[t.id] || []).map((r) => ({ who: name(r.author_id) || 'Sober Book', body: r.body, at: r.created_at })),
  }));

  return <Board tickets={list} />;
}
