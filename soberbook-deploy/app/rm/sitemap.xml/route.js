import { db } from '../../../lib/rm/server';
import { placePath } from '../../../lib/rm/words';

/* myrecoverymap.org/sitemap.xml — every place page plus the main pages.
   Permanent addresses, so these stop breaking on each data refresh. */
export const dynamic = 'force-dynamic';
export const revalidate = 86400;

export async function GET() {
  const site = 'https://myrecoverymap.org';
  const pages = ['', '/search', '/guide', '/housing', '/meetings', '/narcan', '/online', '/no-insurance', '/for-you', '/ask', '/about', '/privacy', '/terms', '/contact'];
  const rows = [];
  for (let off = 0; off < 30000; off += 10000) {
    const { data } = await db().rpc('rm_sitemap', { p_offset: off });
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 10000) break;
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((p) => `<url><loc>${site}${p}</loc></url>`).join('\n') + '\n' +
    rows.map((r) => `<url><loc>${esc(site + placePath(r))}</loc></url>`).join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
