export function GET() {
  return new Response('User-agent: *\nAllow: /\n\nSitemap: https://myrecoverymap.org/sitemap.xml\n', { headers: { 'content-type': 'text/plain' } });
}
