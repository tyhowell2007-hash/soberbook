import { headers } from 'next/headers';
import { brandFromUA } from './brand';

/* Server components: the same answer lib/brand.js gives in the browser,
   read from the request's user agent. Calling it makes the page dynamic,
   which every signed-in page already is. */
export function serverBrand() {
  try { return brandFromUA(headers().get('user-agent') || ''); }
  catch { return brandFromUA(''); }
}
