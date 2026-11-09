import { redirect } from 'next/navigation';
import { base } from '../../../lib/rm/server';

/* "No insurance?" is now a section of Start here (9 Nov 2026), word for
   word. This keeps old links and bookmarks working. */
export default function NoInsurance() {
  redirect(`${base()}/for-you#money`);
}
