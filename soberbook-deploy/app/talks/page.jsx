import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import TalksHome from './TalksHome';

export const dynamic = 'force-dynamic';

/* What's live, and the "Go live" sheet. ?start=<room slug> opens the sheet
   on that room (the rooms page links here). */
export default async function TalksPage({ searchParams }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: rooms }, { data: live }, { data: canHost }, { data: me }] = await Promise.all([
    supabase.from('rooms').select('slug, emoji, name, anonymous').eq('active', true).order('sort'),
    supabase.rpc('talks_live'),
    supabase.rpc('can_host_meetings'),
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
  ]);

  const start = typeof searchParams?.start === 'string' ? searchParams.start : null;

  return (
    <TalksHome
      rooms={rooms || []}
      initial={Array.isArray(live) ? live : []}
      canHost={!!canHost || !!me?.is_admin}
      startRoom={start}
    />
  );
}
