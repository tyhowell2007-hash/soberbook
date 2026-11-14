'use client';

import { useBrand } from './BrandProvider';

/* "Sober Book" on the web, "Recovery Belongs" inside the iPhone app.
   Use it wherever OUR words name the app. Never on member words.
   `initials` gives the two-letter mark: SB / rb. `mark` gives the
   top-bar wordmark text. */
export default function BrandName({ initials = false, mark = false }) {
  const b = useBrand();
  if (mark) return b.key === 'rb' ? 'recovery belongs' : '🌱 SOBER BOOK';
  if (initials) return b.key === 'rb' ? 'rb' : 'SB';
  return b.name;
}
