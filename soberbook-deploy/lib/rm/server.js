import { headers, cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import ZIPS from './zips.json';

/* =====================================================================
   RECOVERYMAP — server helpers.  31 Oct 2026.

   ⭐ ONE CODEBASE, TWO ADDRESSES. On myrecoverymap.org the middleware
   rewrites every path to /rm/…, so a link must be written WITHOUT /rm
   there. On soberbook.app (where the team tests it first) the same page
   lives at /rm/…, so links need the prefix. base() answers which.

   🔴 db() IS THE ANON CLIENT, ON PURPOSE — no cookies. A person looking
   for help is never signed in to RecoveryMap, and reading the public
   rm_* functions as anon means a page can never accidentally show
   something only a signed-in member should see.
   ===================================================================== */

export const RM_HOSTS = ['myrecoverymap.org', 'www.myrecoverymap.org'];

export function onRmHost() {
  const h = (headers().get('host') || '').toLowerCase().split(':')[0];
  return RM_HOSTS.includes(h);
}
export const base = () => (onRmHost() ? '' : '/rm');
export const siteUrl = () => (onRmHost() ? 'https://myrecoverymap.org' : 'https://soberbook.app/rm');

export function lang() {
  return cookies().get('rm_lang')?.value === 'es' ? 'es' : 'en';
}

let _db;
export function db() {
  if (!_db) {
    _db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _db;
}

/* ---------------------------------------------------------------------
   WHERE IS "NEAR"?  Accepts:
     43907 · 43907-1234 · "Cadiz, OH" · "Cadiz OH" · "Cadiz" · "40.27,-80.99"
   ZIP centroids come from the GeoNames table RecoveryMap already used
   (public domain, 41,706 ZIPs). A town is the middle of its ZIPs.
   🔴 Returns null when it can't tell — the page then says so, instead
   of quietly searching the whole country (the old site's bug).
   ------------------------------------------------------------------- */
let TOWN;
function towns() {
  if (TOWN) return TOWN;
  TOWN = new Map();
  for (const [, v] of Object.entries(ZIPS)) {
    const key = `${v[2].toLowerCase()}|${v[3]}`;
    const t = TOWN.get(key) || { lat: 0, lon: 0, n: 0, city: v[2], state: v[3] };
    t.lat += v[0]; t.lon += v[1]; t.n += 1;
    TOWN.set(key, t);
  }
  for (const t of TOWN.values()) { t.lat /= t.n; t.lon /= t.n; }
  return TOWN;
}
const ABBR = { ohio: 'OH', 'west virginia': 'WV', pennsylvania: 'PA', kentucky: 'KY', indiana: 'IN', michigan: 'MI', illinois: 'IL', 'new york': 'NY' };

export function geocode(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  const ll = q.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (ll) return { lat: +ll[1], lon: +ll[2], label: 'your location' };
  const z = q.match(/\b(\d{5})(?:-?\d{4})?\b/);
  if (z && ZIPS[z[1]]) {
    const v = ZIPS[z[1]];
    return { lat: v[0], lon: v[1], label: `${v[2]}, ${v[3]} ${z[1]}`, city: v[2], state: v[3] };
  }
  const m = q.replace(/\s+/g, ' ').match(/^(.+?)(?:,\s*|\s+)([A-Za-z]{2}|[A-Za-z ]{4,})$/);
  const T = towns();
  if (m) {
    const st = m[2].length === 2 ? m[2].toUpperCase() : ABBR[m[2].toLowerCase().trim()];
    const hit = st && T.get(`${m[1].trim().toLowerCase()}|${st}`);
    if (hit) return { lat: hit.lat, lon: hit.lon, label: `${hit.city}, ${hit.state}`, city: hit.city, state: hit.state };
  }
  /* A bare town name: take the one with the most ZIPs (the biggest). */
  let best = null;
  for (const t of T.values()) if (t.city.toLowerCase() === q.toLowerCase() && (!best || t.n > best.n)) best = t;
  return best ? { lat: best.lat, lon: best.lon, label: `${best.city}, ${best.state}`, city: best.city, state: best.state } : null;
}
