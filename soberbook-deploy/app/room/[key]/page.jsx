import { redirect, notFound } from 'next/navigation';
import { serverClient, assertReadable } from '../../../lib/supabase-server';
import Room from './Room';

export const dynamic = 'force-dynamic';

/* A member's meeting room.

   ⚠️ The lookup IS the authorisation, same pattern as /chat/[id].
   open_meeting_rooms only ever contains rooms that are open, hosted by
   somebody who isn't suspended, and not run by anyone either of you has
   blocked. A room you may not enter comes back as no row, and no row is
   a 404. There is no separate "are you allowed" line in this file to
   forget to write. */
export default async function RoomPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const key = decodeURIComponent(params.key || '');

  const { data: room } = await supabase
    .from(assertReadable('open_meeting_rooms'))
    .select('room_key, title, host_name, is_mine')
    .eq('room_key', key)
    .maybeSingle();

  if (!room) notFound();

  /* The handle, not the real name — a handle is the name somebody chose
     for this place, and it is what the rest of the app calls them. */
  const { data: mine } = await supabase
    .from('profiles').select('handle').eq('id', user.id).maybeSingle();

  return (
    <Room
      roomKey={room.room_key}
      title={room.title}
      hostName={room.host_name}
      isMine={room.is_mine}
      me={mine?.handle || 'friend'}
    />
  );
}
