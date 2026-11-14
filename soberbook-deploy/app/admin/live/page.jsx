import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';
import { adminClient, adminConfigured } from '../../../lib/supabase-admin';
import Live from './Live';
import '../../tickets.css';

export const dynamic = 'force-dynamic';

/* =====================================================================
   /admin/live — EVERY LIVE ROOM. 0204, 13 Nov 2026.
   Ty and Kenny only. Talks (Sober Book's own audio/video) and member
   meeting rooms (Daily), with how many are in each, Drop in and End.
   End uses talk_end (admins already pass talk_is_mod) and
   admin_close_meeting_room. No names of anyone inside, just counts.
   ===================================================================== */
export default async function LivePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: mod } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin || !adminConfigured()) notFound();

  const admin = adminClient();
  const since30s = new Date(Date.now() - 30000).toISOString();
  const { data: talks } = await admin.from('talks').select('id, topic, host_id, started_at, locked_at')
    .is('ended_at', null).gte('started_at', new Date(Date.now() - 12 * 36e5).toISOString()).order('started_at', { ascending: false });
  const { data: rooms } = await admin.from('meeting_rooms').select('id, title, host_id, created_at, room_key')
    .is('closed_at', null).gte('created_at', new Date(Date.now() - 12 * 36e5).toISOString()).order('created_at', { ascending: false });

  const hostIds = [...new Set([...(talks || []), ...(rooms || [])].map((x) => x.host_id))];
  const hosts = {};
  if (hostIds.length) {
    const { data } = await admin.from('profiles').select('id, handle').in('id', hostIds);
    (data || []).forEach((p) => { hosts[p.id] = p.handle; });
  }
  const counts = {};
  if (talks?.length) {
    const { data } = await admin.from('talk_people').select('talk_id').in('talk_id', talks.map((t) => t.id))
      .is('removed_at', null).gte('last_seen', since30s);
    (data || []).forEach((r) => { counts[r.talk_id] = (counts[r.talk_id] || 0) + 1; });
  }
  const list = [
    ...(talks || []).map((t) => ({ type: 'talk', id: t.id, title: t.topic || 'Talk', host: hosts[t.host_id], since: t.started_at, locked: !!t.locked_at, people: counts[t.id] || 0, href: `/talks/${t.id}` })),
    ...(rooms || []).map((r) => ({ type: 'room', id: r.id, title: `Meeting room: ${r.title || 'untitled'}`, host: hosts[r.host_id], since: r.created_at, href: `/room/${r.room_key}` })),
  ];
  return <Live list={list} />;
}
