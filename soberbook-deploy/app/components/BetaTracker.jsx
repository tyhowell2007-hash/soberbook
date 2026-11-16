'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initTracking, trackScreen, screenName } from '../../lib/track';

/* Beta usage tracking (0206, Kenny's plan). Mounted in the root layout for
   signed-in members only. It asks the server once whether this member is a
   tester who agreed; for everyone else it sends nothing at all. */
export default function BetaTracker({ on }) {
  const pathname = usePathname();
  useEffect(() => { if (on) initTracking(); }, [on]);
  useEffect(() => { if (on) trackScreen(screenName(pathname)); }, [on, pathname]);
  return null;
}
