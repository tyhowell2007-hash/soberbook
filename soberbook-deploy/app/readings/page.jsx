import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Readings from './Readings';
import { readingForToday, libraryIndex } from './rotation';

/* ⚠️ force-dynamic, and now it MATTERS more than it did. The page's
   content depends on today's date in New York. Statically rendered at
   build time it would freeze on whatever day Vercel built it and serve
   that reading until the next deploy — which is exactly the silent
   failure this rotation was designed to avoid. */
export const dynamic = 'force-dynamic';

/* The readings.

   ⚠️ NO DATABASE CALL IN THIS FILE AND NO TABLE BEHIND IT. The 130
   passages are public-domain text compiled into the bundle. That is
   not a shortcut — it's the same decision as the practices: there is
   nothing to store, so there is nothing to leak, subpoena, or turn
   into a streak.

   The auth check stays, though. ⚠️ Not because the scripture is
   secret — it's public domain, it's on a hundred websites — but
   because a page at soberbook.app that Google can crawl is a page that
   attaches "Bible study" to the domain in search results, and members
   did not sign up to have their app read that way from outside.
   Everything behind the login is noindex by construction. */
export default async function ReadingsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* ⚠️ Computed on the SERVER. Doing it in the browser would use the
     device's clock, so a phone with the wrong date would quietly show
     the wrong day's reading and nobody would ever find out. */
  return <Readings today={readingForToday()} index={libraryIndex()} />;
}
