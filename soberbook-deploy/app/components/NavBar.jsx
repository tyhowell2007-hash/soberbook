import { serverClient } from '../../lib/supabase-server';
import BottomNav from './BottomNav';

/* =====================================================================
   THE BAR, WITH THE THREE FACTS IT NEEDS.

   BottomNav is a client component (it needs usePathname). This is the
   server half: one query, three booleans, handed down.

   ⚠️ ONE ROW, NOT THREE QUERIES. This renders on every page in the app,
   so it runs constantly. See 0026 — the view does all three exists()
   checks in a single trip.

   ⚠️ BOOLEANS, NOT COUNTS, AND THAT IS ENFORCED BY THE VIEW. There is no
   number anywhere in this path to accidentally render as a badge. A
   climbing count is a slot machine; on a recovery app that's the harm.
   ===================================================================== */
export default async function NavBar() {
  const supabase = serverClient();

  /* Signed out, or mid-refresh: no dots. ⚠️ NEVER THROW FROM HERE — this
     renders inside the layout, so an error takes down every page that
     shows the bar, which is all of them. A missing dot is a small bug; a
     white screen is not. */
  let dots = { home: false, chat: false, meetings: false };
  try {
    const { data } = await supabase
      .from('my_nav_dots')
      .select('home, chat, meetings')
      .maybeSingle();
    if (data) dots = data;
  } catch { /* leave them all off */ }

  return <BottomNav dots={dots} />;
}
