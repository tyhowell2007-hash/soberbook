import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Readings from './Readings';

export const dynamic = 'force-dynamic';

/* The readings.

   ⚠️ NO DATABASE CALL IN THIS FILE AND NO TABLE BEHIND IT. The six
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

  return <Readings />;
}
