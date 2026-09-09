/* =====================================================================
   BRING ONE PERSON — the link, and how it leaves the phone.

   ⚠️ NO 'use client' AT THE TOP, DELIBERATELY. Two components need this
   (the card on Home, the line on /me) and a page.jsx may need the URL
   one day. On 2 Sept a server component imported a named export out of a
   'use client' file, Next turned it into a client reference rather than a
   function, and /wall answered every member with a server-side exception
   — with a green build the whole time. A function two runtimes both need
   belongs to NEITHER of them. Same shape as lib/open-room.js,
   lib/previews.js and lib/drops.js.

   ⚠️ Do not "tidy" this back into the component. The server can never
   call it again if you do.
   ===================================================================== */

/* 🔴 THE LINK CARRIES NO AUTHOR, AND THAT IS THE DESIGN, NOT AN
   OVERSIGHT.

   Ty took this call after being shown the trade. A per-member invite code
   would give perfect attribution and would also build **a map of
   real-world relationships between people in recovery**, on a database
   where 212 of 245 members are anonymous. That map can leak and it can be
   subpoenaed, and it is the one dataset capable of quietly undoing the
   anonymity every other rule in this app protects: an anonymous alias,
   plus "invited by X", plus X's own contacts, is a de-anonymisation in
   two hops.

   So the parameter is a flag, not an identity. `i=1` is the same six
   characters for all 245 members. The database learns THAT somebody
   arrived through an invite (0156, `came_from`) and can never learn whose.

   ⚠️ It is also why there is no invite count anywhere. A number beside
   your name is a score, and the moment bringing people is scored this
   stops being a favour and becomes a referral scheme, in a room full of
   people who have been sold to before. */
export const INVITE_URL = 'https://soberbook.app/?i=1';

/* What the member sends. Written once here rather than typed into two
   components, because the two copies drift — 0046 → 0047 → 0049, three
   scars in this schema from exactly that.

   ⚠️ It does not describe the person receiving it, and it never says
   "you're in recovery" or anything like it. A message forwarded into
   somebody's phone may be read over their shoulder, by a partner, a
   parent or a boss. It says what the place is and nothing about them. */
export const INVITE_TEXT =
  'Sober Book — somewhere to talk without doing the explaining first. Free, and you can be anonymous.';

/**
 * Hand the invite to whatever the phone uses to talk to people.
 *
 * ⭐ THE SHARE SHEET IS THE POINT, WHERE IT EXISTS. It opens the member's
 * own messages, and they pick the person. **We never see the sheet, the
 * contact, or whether they sent anything** — the browser hands us nothing
 * back but "shared" or "cancelled". That is a stronger privacy guarantee
 * than any promise we could write, because there is no channel through
 * which the information could reach us.
 *
 * 🔴 AND IT IS WHY THERE IS NO CONTACT UPLOAD, EVER. Asking a recovery
 * app for your address book is a horror, and it is also the standard
 * growth playbook — which is exactly why it needs saying out loud here
 * rather than just not being written. If somebody proposes it later, this
 * comment is the answer.
 *
 * Returns one of: 'shared' | 'copied' | 'cancelled' | 'manual'
 * ⚠️ 'manual' means BOTH routes refused and the caller must now show the
 * address on screen. A copy button that silently does nothing is the
 * thirteen-times-repeated "everything built except the way in" bug, and
 * it fails on exactly the phones we care about — some iOS webviews reject
 * navigator.clipboard outside a narrow gesture window.
 */
export async function shareInvite() {
  /* ⚠️ Feature-detect `navigator.share`, then CALL it inside the original
     tap. Awaiting anything before this point on iOS spends the user
     gesture and the sheet is refused — the same class of problem as the
     audio unlock, where iOS blesses an element rather than a page. */
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text: INVITE_TEXT, url: INVITE_URL });
      return 'shared';
    } catch (e) {
      /* ⚠️ A cancel and a failure both land here, and they are NOT the
         same thing. Cancelling is a decision — falling through to the
         clipboard would put a link on their pasteboard they just declined
         to send. AbortError is the cancel; anything else is a real
         failure worth falling through for. */
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${INVITE_TEXT} ${INVITE_URL}`);
      return 'copied';
    }
  } catch { /* falls through to manual on purpose */ }

  return 'manual';
}
