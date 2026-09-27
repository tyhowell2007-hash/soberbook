/* ⚠️ THIS FILE EXISTS FOR ONE REASON AND IT IS NOT TIDINESS.

   TRANSLATION used to live in texts.js. Passage.jsx is a CLIENT module,
   so importing it from there pulls texts.js into the client graph — and
   texts.js is 120KB of scripture. Tree-shaking might remove the unused
   READINGS array and might not; "might" is not good enough to put 120KB
   on every phone that opens the page.

   One string, its own file, no doubt about it. */
export const TRANSLATION = 'World English Bible · public domain';
