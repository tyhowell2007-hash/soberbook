import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';
import Flags from './Flags';
import '../../tickets.css';

export const dynamic = 'force-dynamic';

/* =====================================================================
   /admin/accounts — FAKE AND BANNED ACCOUNTS. 0203, 13 Nov 2026.
   Prototype approved by Ty: claude.ai/artifact/AeQ3mxECQBo8N7XJKwv2iU
   Ty and Kenny only (404 for anyone else). Read with the service role
   after the is_admin check: account_flags has no member grants at all.
   Each flag shows counts only (friend requests, new chats, posts), never
   anything anyone wrote. Buttons run account_flag_act(), which checks
   is_moderator() again in the database.
   ===================================================================== */
export default async function AccountsBoard() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: mod } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin || !adminConfigured()) notFound();

  const admin = adminClient();
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const { data: rows } = await admin.from('account_flags').select('*')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(200);
  const flags = rows || [];
  const ids = [...new Set(flags.map((f) => f.user_id))];
  const people = {};
  if (ids.length) {
    const { data } = await admin.from('profiles').select('id, handle, created_at, suspended_at').in('id', ids);
    (data || []).forEach((p) => { people[p.id] = { ...p, requests: 0, chats: 0, posts: 0 }; });
    const [{ data: fr }, { data: th }, { data: po }] = await Promise.all([
      admin.from('friendships').select('requested_by').in('requested_by', ids),
      admin.from('threads').select('started_by').in('started_by', ids),
      admin.from('posts').select('author_id').in('author_id', ids),
    ]);
    (fr || []).forEach((r) => { if (people[r.requested_by]) people[r.requested_by].requests++; });
    (th || []).forEach((r) => { if (people[r.started_by]) people[r.started_by].chats++; });
    (po || []).forEach((r) => { if (people[r.author_id]) people[r.author_id].posts++; });
  }
  const list = flags.map((f) => {
    const p = people[f.user_id] || {};
    return {
      id: f.id, kind: f.kind, detail: f.detail, status: f.status, created_at: f.created_at,
      handle: p.handle || 'unknown', joined: p.created_at, suspended: !!p.suspended_at,
      requests: p.requests || 0, chats: p.chats || 0, posts: p.posts || 0,
    };
  });
  return <Flags flags={list} />;
}
