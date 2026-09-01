/* =====================================================================
   THE WALKTHROUGH EMAIL.

   One email, to 146 members, about soberbook.app/tour.

   🔴 WHAT THIS EMAIL IS NOT ALLOWED TO DO, and every line is written
   against these:

   1. It must not NUDGE. 130 members were emailed a promise of "no
      reminders, no streaks, no nudges to come back". So there is no
      call to action beyond a link, no "don't miss out", and no count of
      what they have missed.

      🔴 IT ALSO MUST NOT SOUND FLIPPANT, AND MY FIRST DRAFT DID. It
      closed on "That's it. No homework, nothing to do. Watch it or
      don't." Ty cut it: *"We don't wanna sound like dickheads to
      people. We don't know."* He is right, and the reason is worth
      keeping: that line reads as easy-going from someone whose voice
      you already know, and as dismissive from a stranger. 146 people
      are about to read this and most of them have never heard Ty
      speak — 106 have never posted a word. **Written warmth cannot
      rely on tone the reader has no way to hear.**

      ⚠️ Deleted, not replaced. The instinct is to write something
      softer in its place; the letter is better without a closing
      flourish at all.

   2. It must not say what the app's own EMAIL SWITCH says it says.
      That switch tells members they will be emailed "when somebody
      answers you or sends you a message". This is neither. So the
      footer says out loud that this is the only email of its kind —
      ⚠️ which makes it a PROMISE. A second announcement makes that
      sentence a lie, and this app does not get to make claims it
      cannot keep (cf. "verified, real people", killed 15 Aug).

   3. It must not name a member count. It moves, and a number invites
      the reader to work out whether they are behind.

   4. It must carry a working one-click unsubscribe. Without one, the
      first person who wants out presses "report spam" instead, and
      that damages delivery of the reply notifications for all 146.
   ===================================================================== */

export const TOUR_BROADCAST_KEY = 'tour-2026-09-01';

export function tourEmail({ optoutUrl }) {
  const subject = 'I made a walkthrough of Sober Book';

  /* ⚠️ The plain-text part is not politeness. An HTML-only body is a
     well-known spam signal, and it is what a stripped-down mail app and
     every screen reader will actually read. It says the same things. */
  const text = [
    "Hi — it's Ty.",
    '',
    "A few people have told me they signed up and weren't sure what half of it",
    'does. Fair enough. There’s more in there than it looks like.',
    '',
    'So I made a walkthrough. Fourteen minutes, the whole thing — signing up,',
    'your day count, the wall, replies, chat, the Front Room, meetings, Quiet,',
    "your own page, and the bits nobody finds on their own.",
    '',
    'https://soberbook.app/tour',
    '',
    'Three things people keep missing:',
    '',
    '  · You can change your sober date whenever you want — and put in the',
    '    years you already had before you got here.',
    '  · The bell tells you when somebody answered you. Easy to walk past.',
    '  · You can post without your name on it.',
    '',
    '— Ty',
    'soberbook.app',
    '',
    '---',
    "This is the only email like this you'll get from me. Otherwise Sober Book",
    'only ever emails you when an actual person has answered you.',
    'Stop all emails: ' + optoutUrl,
  ].join('\n');

  /* ⚠️ Inline styles only — Gmail strips <style> blocks, and a
     stylesheet that half-applies looks worse than none. Kept close to
     the app's own green so it is recognisably from the same place. */
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7faf8;">
<div style="max-width:560px;margin:0 auto;padding:28px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#17281e;">
  <p style="margin:0 0 16px;">Hi &mdash; it&rsquo;s Ty.</p>
  <p style="margin:0 0 16px;">A few people have told me they signed up and weren&rsquo;t sure what half of it does. Fair enough. There&rsquo;s more in there than it looks like.</p>
  <p style="margin:0 0 20px;">So I made a walkthrough. Fourteen minutes, the whole thing &mdash; signing up, your day count, the wall, replies, chat, the Front Room, meetings, Quiet, your own page, and the bits nobody finds on their own.</p>
  <p style="margin:0 0 22px;">
    <a href="https://soberbook.app/tour" style="display:inline-block;background:#2b5c3f;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:16px;">Watch the walkthrough</a>
  </p>
  <p style="margin:0 0 8px;">Three things people keep missing:</p>
  <ul style="margin:0 0 20px;padding-left:20px;">
    <li style="margin-bottom:6px;">You can change your sober date whenever you want &mdash; and put in the years you already had before you got here.</li>
    <li style="margin-bottom:6px;">The bell tells you when somebody answered you. Easy to walk straight past.</li>
    <li>You can post without your name on it.</li>
  </ul>
  <p style="margin:0 0 4px;">&mdash; Ty</p>
  <p style="margin:0 0 24px;color:#5f7a6a;">soberbook.app</p>
  <hr style="border:0;border-top:1px solid #e4ebe7;margin:0 0 14px;">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#5f7a6a;">
    This is the only email like this you&rsquo;ll get from me. Otherwise Sober Book only ever emails you when an actual person has answered you.
    <a href="${optoutUrl}" style="color:#5f7a6a;">Stop all emails</a>.
  </p>
</div></body></html>`;

  return { subject, html, text };
}
