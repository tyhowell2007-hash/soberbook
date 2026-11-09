import { redirect } from 'next/navigation';
import { base } from '../../../lib/rm/server';

export const metadata = { title: 'RecoveryMap' };

/* Removed 9 Nov 2026 (Kenny): RecoveryMap carries no personal brand.
   Old links to this page go to the RecoveryMap home. */
export default function Ask() {
  redirect(base() || '/');
}
