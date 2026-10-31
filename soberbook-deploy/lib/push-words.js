/* =====================================================================
   WHAT A LOCK SCREEN SAYS — chosen by the path alone.  31 Oct 2026.

   The iPhone app's alerts are sent by our server through Apple, so the
   words have to be decided HERE rather than in public/sw.js (the website
   alerts still choose theirs in sw.js).

   ⚠️ THIS LIST AND THE ONE IN public/sw.js MUST SAY THE SAME THING.
   sw.js is a static file and can't import this one. Change one, change
   both, or a phone and a laptop will describe the same event differently.

   🔴 Same two rules as sw.js: never a name, never a word from a post. A
   meeting reminder never names the meeting. The input is a PATH and the
   output is a constant.
   ===================================================================== */

export const PUSH_TITLE = 'Sober Book';

/** Only a same-site path is allowed through — no links out of the app. */
export function safePath(to) {
  return typeof to === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(to) ? to : '/wall';
}

export function pushWords(rawTo) {
  const to = safePath(rawTo);
  const urgent = to === '/admin/urgent';
  const body = to === '/meetings' ? 'A meeting you marked starts soon.'
             : to.startsWith('/chat') ? 'Somebody sent you a message.'
             : urgent ? 'Urgent report: someone may be in danger. Open the queue.'
             : to === '/admin' ? 'A new report is waiting. Open the queue when you can.'
             : to === '/checkin' ? 'Someone here is thinking of you.'
             : to.endsWith('/stats/coins') ? 'Somebody sent you a coin.'
             : to.endsWith('/stats') ? 'Your post just earned a milestone chip.'
             : 'Somebody answered you.';
  return { to, body, urgent };
}
