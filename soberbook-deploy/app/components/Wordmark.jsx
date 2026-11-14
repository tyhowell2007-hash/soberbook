'use client';

import { useBrand } from './BrandProvider';

/* The name in the top bar. Sober Book on the web (unchanged); inside the
   iPhone app, "recovery belongs" in the logo font and the logo green
   (brand.css). */
export default function Wordmark() {
  const b = useBrand();
  return b.key === 'rb'
    ? <span className="lg rb-wm">recovery belongs</span>
    : <span className="lg">{'🌱 SOBER BOOK'}</span>;
}
