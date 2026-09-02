/* =====================================================================
   THE WALKTHROUGH, AGAIN — 2 Sept 2026. Ty's call: everybody, all 185.

   🔴 WHY A SECOND KEY RATHER THAN RE-RUNNING 'tour'.
   broadcast_sends is keyed on (broadcast_key, member_id) and that is
   the ONLY thing standing between us and somebody getting a duplicate.
   Reusing 'tour-2026-09-01' would send to nobody at all — 151 rows
   already exist and the claim would collide. Clearing those rows to
   "re-send" would delete the record that stops a third send. So: a new
   key, and the old one stays as history.

   ⚠️ THIS IS THE THIRD EMAIL IN THREE DAYS, and the walkthrough email
   itself promised "the only email like this you'll get from me". The
   survey already broke that once and said so. Doing it twice without
   acknowledging it is how people stop opening anything — so this one
   opens by naming it, and the reason is concrete rather than a
   marketing beat: WE GOT THE LENGTH WRONG ON OUR OWN PAGE.

   ⭐ THE SUBJECT LINE LEADS WITH THE NUMBER, because the number is the
   whole news. 151 people already got an email saying "three and a half
   minutes", tapped through, and were told by the app it was fourteen.
   Whatever they decided about the film, they decided it against a wrong
   figure.

   ⚠️ NO NUDGE, still. 130 members were promised "no reminders, no
   streaks, no nudges to come back". No day counts, no "we miss you", no
   "look what's new since you left". A correction, a link, a door out.

   ⚠️ NOTHING IN HERE COUNTS MEMBERS. The survey email takes a live
   member count because its argument needs one; this one doesn't, so it
   doesn't take the argument. A number in an email is a promise you have
   to keep maintaining somewhere else.
   ===================================================================== */

export const TOUR2_BROADCAST_KEY = 'tour-rerun-2026-09-02';

export function tour2Email({ optoutUrl }) {
  const subject = 'The walkthrough is three and a half minutes, not fourteen';

  /* ⚠️ The plain-text part is not politeness. An HTML-only body is a spam
     signal, and some people read mail in clients that never render it. */
  const text = [
    'Hey —',
    '',
    'Quick correction, and it is our fault.',
    '',
    'There is a walkthrough of Sober Book. Our own page said it was',
    'fourteen minutes long. It is three and a half.',
    '',
    'The film got shortened and we never updated the words around it, so',
    'anyone who went to watch it was told it was four times longer than it',
    'is. If you took one look at that and decided you did not have the',
    'time, that was us, not you.',
    '',
    '  https://soberbook.app/tour',
    '',
    'It covers the things nobody finds on their own — going anonymous, the',
    'number that never resets, the Front Room, and how to get into a',
    'meeting from your phone.',
    '',
    '(And yes, this is the third email this week. That is more than I said',
    "there would be. It goes quiet after this.)",
    '',
    'Ty',
    'soberbook.app',
    '',
    'Stop all emails: ' + optoutUrl,
  ].join('\n');

  /* ⚠️ Inline styles only — Gmail strips <style> blocks. */
  const html = `
<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C2320;max-width:520px;margin:0 auto;padding:8px 4px;">
  <p style="margin:0 0 16px;">Hey &mdash;</p>
  <p style="margin:0 0 16px;">Quick correction, and it&rsquo;s our fault.</p>
  <p style="margin:0 0 16px;">There&rsquo;s a walkthrough of Sober Book. Our own page said it was fourteen minutes long. It&rsquo;s <b>three and a half</b>.</p>
  <p style="margin:0 0 20px;">The film got shortened and we never updated the words around it, so anyone who went to watch it was told it was four times longer than it is. If you took one look at that and decided you didn&rsquo;t have the time &mdash; that was us, not you.</p>
  <p style="margin:0 0 22px;">
    <a href="https://soberbook.app/tour" style="display:inline-block;background:#1B6B4A;color:#F7FAF8;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:10px;">Watch it &mdash; 3&frac12; minutes</a>
  </p>
  <p style="margin:0 0 16px;">It covers the things nobody finds on their own &mdash; going anonymous, the number that never resets, the Front Room, and how to get into a meeting from your phone.</p>
  <p style="margin:0 0 16px;color:#63716A;font-size:14.5px;">(And yes &mdash; this is the third email this week. That&rsquo;s more than I said there would be. It goes quiet after this.)</p>
  <p style="margin:0 0 20px;">Ty<br><a href="https://soberbook.app" style="color:#256F4C;">soberbook.app</a></p>
  <p style="margin:0;font-size:13px;color:#63716A;border-top:1px solid #DCE7E1;padding-top:14px;">
    <a href="${optoutUrl}" style="color:#63716A;">Stop all emails</a>.
  </p>
</div>`.trim();

  return { subject, html, text };
}
