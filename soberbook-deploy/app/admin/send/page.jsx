import { notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import Send from './Send';

export const dynamic = 'force-dynamic';

/* =====================================================================
   SENDING THE WALKTHROUGH EMAIL.

   ⭐ WHY THIS PAGE EXISTS RATHER THAN A SCRIPT I RUN. The Resend key
   lives in Vercel's environment. Sending from outside the app means
   putting that key somewhere it can be read — a chat window, a shell
   history, a file. A button inside the app uses the key without anybody
   seeing it, and Ty's own login is the authorisation.

   ⚠️ 404, not "not allowed" — the /admin convention. A polite refusal
   confirms the route is real and worth attacking.

   ⚠️ This check is a convenience over a locked door, not the lock. The
   route behind it does its own owner check, and the database functions
   it calls are revoked from `authenticated` entirely. Delete this file
   and nobody can still send anything.
   ===================================================================== */
export default async function SendPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  return (
    <div className="pad">
      <h1>The walkthrough email</h1>
      <p className="hint">
        One email, to everybody who has email switched on, linking to{' '}
        <Link href="/tour">soberbook.app/tour</Link>. Nobody can get it twice.
      </p>
      <Send />

      {/* ⚠️ Written on the page, not just in a commit message, because
          this is the thing that will be forgotten in six weeks. */}
      <p className="hint">
        The email says out loud that it is <b>the only one like it</b> anybody
        will get. That sentence is a promise. A second announcement down this
        pipe makes it a lie, and this app does not make claims it can&apos;t keep.
      </p>
    </div>
  );
}
