import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { serverClient } from '../../../lib/supabase-server';
import Passage from '../Passage';
import { readingById } from '../rotation';

export const dynamic = 'force-dynamic';

/* ONE READING, OPENED OUT OF THE LIBRARY.

   ⚠️ This route exists so the other 129 passages stay OFF the phone
   until somebody asks for one. See the note in Readings.jsx.

   ⚠️ notFound() rather than a redirect on a bad id. A typo'd URL should
   say it does not exist, not silently drop somebody on today's reading
   and let them believe that is what they asked for. */
export default async function OneReadingPage({ params }) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const r = readingById(params.id);
  if (!r) notFound();

  return (
    <Passage
      r={r}
      back={<Link href="/readings" className="rd-back">&larr; all of them</Link>}
    />
  );
}
