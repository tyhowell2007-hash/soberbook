'use client';

import { createContext, useContext } from 'react';
import { BRANDS } from '../../lib/brand';

/* The root layout decides the brand ON THE SERVER (from the user agent)
   and hands it down, so the very first paint already says the right
   name — no "Sober Book" flash inside the iPhone app. See lib/brand.js. */
const Ctx = createContext(BRANDS.sb);

export function BrandProvider({ brand, children }) {
  return <Ctx.Provider value={BRANDS[brand] || BRANDS.sb}>{children}</Ctx.Provider>;
}

export function useBrand() { return useContext(Ctx); }
