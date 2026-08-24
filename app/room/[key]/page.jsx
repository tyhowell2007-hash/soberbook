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

  /* ⚠️ THE HANDLE LOOKUP USED TO LIVE HERE AND IT IS GONE ON PURPOSE.
     Your name in the meeting is now baked into a Daily meeting token by
     /api/room/ensure, which reads the handle from the session itself.

     Looking it up here as well would be a second copy of the same fact,
     and the pattern this codebase keeps getting bitten by is exactly
     that — a rule enforced in one place and restated in another, where
     the restatement quietly drifts (0046, then again in 0049). The
     browser can't be trusted with the name anyway, so the only sensible
     place to read it is the same request that signs it. */

  return (
    <Room
      roomKey={room.room_key}
      title={room.title}
      hostName={room.host_name}
      isMine={room.is_mine}
    />
  );
}
