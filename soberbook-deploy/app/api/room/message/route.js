import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { adminClient } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   TAKING BACK A MESSAGE IN THE FRONT ROOM — row and pictures both.

   ---------------------------------------------------------------------
   ⚠️ WHY THIS ISN'T JUST AN RPC CALL FROM THE BROWSER

   delete_my_room_message() is a SECURITY DEFINER function the browser
   could call directly. It handles the row perfectly well. What it cannot
   do is reach into storage — that needs the service role key, which the
   browser must never hold (0022: the browser has NO storage permissions
   at all, which is what makes the metadata strip unskippable).

   So a browser-only delete would take the message off every screen and
   leave the photos sitting in the bucket. "Delete" would quietly mean
   "hide", which in an app where somebody may be deleting a picture of
   their own face is not a small difference.

   ---------------------------------------------------------------------
   ⭐ THE FUNCTION HANDS BACK THE PATHS, AND THAT ORDER IS THE DESIGN

   0094 reads photo_urls BEFORE nulling the column, and returns what it
   read. Two things follow:

     · we learn which files to remove without ever asking the caller —
       a route that accepted a list of paths would be a route that
       deletes anybody's photos for anybody who can type one.

     · clearing the column removes them from referenced_media(), so if
       the storage delete below fails, the orphan sweeper takes them on
       its next pass. Two independent roads to the same "gone", and
       neither depends on this request finishing.

   ⚠️ Ownership is never checked here. It is checked inside the function,
   in the same statement as the update — so there is no window between
   "is it yours" and "delete it", and no second copy of the rule to drift.
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 400 });
  }

  const { data: paths, error } = await supabase
    .rpc('delete_my_room_message', { msg_id: id });

  if (error) {
    return NextResponse.json({ error: 'Couldn’t do that.' }, { status: 400 });
  }

  /* ⚠️ An empty array means nothing matched — somebody else's message, or
     one already deleted. Same reply either way; two different messages
     would let a caller probe which message ids are real. It is NOT an
     error, because a message with no pictures also returns an empty
     array, and those two must not be told apart from out here either. */
  const files = Array.isArray(paths) ? paths.filter(Boolean) : [];

  /* ONE remove() call, never a loop. Ten round trips means the fourth can
     fail after three succeeded, which is the half-cleaned state this
     whole ordering exists to prevent. */
  if (files.length) {
    await adminClient().storage.from('room-photos').remove(files);
  }

  return NextResponse.json({ ok: true });
}
