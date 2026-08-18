import { serverClient } from '../../lib/supabase-server';
import BottomNav from './BottomNav';

/* =====================================================================
   THE BAR, WITH THE ONE FACT IT NEEDS.

   BottomNav is a client component (it needs usePathname). This is the
   server half: it asks the database the single question the dot answers,
   and hands down a boolean.

   ⚠️ `.limit(1)` RATHER THAN A COUNT, AND THAT IS NOT A MICRO-OPTIMISATION.

   If this returned a number, the number would exist — and the next
   person to touch the bar would render it, because a number on hand is a
   number that gets shown. Fetching only "is there at least one" means
   there is no count anywhere in the system to accidentally display. The
   design decision is enforced by what the code is able to know.

   It is also genuinely cheaper: Postgres stops at the first matching row
   instead of walking the whole inbox.
   ===================================================================== */
export default async function NavBar() {
  const supabase = serverClient();

  /* Signed-out or mid-refresh: no dot. Never throw from a layout — a
     failure here would take down every page that renders the bar, which
     is all of them. */
  let hasUnread = false;
  try {
    const { data } = await supabase
      .from('my_notifications')
      .select('id')
      .is('read_at', null)
      .limit(1);
    hasUnread = (data?.length ?? 0) > 0;
  } catch { /* leave it false */ }

  return <BottomNav hasUnread={hasUnread} />;
}
