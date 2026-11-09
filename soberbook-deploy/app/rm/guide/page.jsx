import { redirect } from 'next/navigation';
import { base } from '../../../lib/rm/server';

/* The 3-question guide now lives at the top of Start here (9 Nov 2026).
   This keeps old links and bookmarks working. Guide.jsx stays here and
   is imported by for-you/page.jsx. */
export default function GuidePage() {
  redirect(`${base()}/for-you#guide`);
}
