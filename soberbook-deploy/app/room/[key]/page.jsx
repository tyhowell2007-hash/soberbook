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

  /* ⚠️ The HANDLE, never the display name. A handle is the name somebody
     chose for this place; a display name may be their real one, and a
     video room is the last place to surface that by accident.

     🔴 Everyone showed as "Guest" for one deploy because this lookup was
     removed with the Jitsi code and not reconnected to Daily. In a
     meeting that isn't cosmetic — a room where nobody has a name is a
     room where you can't tell who is talking to you. */
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
