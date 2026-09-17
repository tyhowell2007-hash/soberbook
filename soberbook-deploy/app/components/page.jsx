import { redirect } from 'next/navigation';
import { serverClient } from '../lib/supabase-server';

/* ⭐ THIS FILE IS THE ONE OWNER OF "where does a signed-in person belong",
   and that is why the room lands here rather than in the login form.

   3 Sept — a creator asked Ty for the Kratom 7-OH room, so the whole point
   of `soberbook.app/friends?room=kratom-7oh` is that a STRANGER can follow
   it. The middleware already carries the query through the bounce to
   /login (verified live: signed out, that URL lands on
   `/login?room=kratom-7oh`, control without the param lands on plain
   `/login`). The auth handlers were the only place throwing it away.

   ⚠️ THE ROOM IS HONOURED ONLY AFTER THE PROFILE CHECK, NEVER BEFORE IT.
   Somebody with a login and no profile still goes to /welcome — that is
   the 30 Aug bug where eleven people had an account and no way in, and a
   room link must not become a way to skip first run. */
export default async function Home({ searchParams }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // A signed-in user without a profile row hasn't finished first run.
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('id', user.id).maybeSingle();

  if (!profile) redirect('/welcome');

  /* ⚠️ NOT VALIDATED HERE, ON PURPOSE. /friends already looks the slug up
     and falls back to the Front Room when it doesn't recognise it — proven
     when the address shipped. Checking it again would be a second copy of
     that rule, and the second copy is the one that drifts (0046 → 0049).
     encodeURIComponent is about building a valid URL, not about trust. */
  const room = typeof searchParams?.room === 'string' ? searchParams.room : null;
  redirect(room ? `/friends?room=${encodeURIComponent(room)}` : '/wall');
}
