import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Builder from './Builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resume builder · Sober Book', robots: { index: false, follow: false } };

/* =====================================================================
   /resume — THE RESUME BUILDER.  9 Nov 2026 (0205).
   Signed in only. Everything happens in Builder.jsx; this page just
   makes sure there's somebody to save it for.
   ===================================================================== */
export default async function ResumePage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <Builder />;
}
