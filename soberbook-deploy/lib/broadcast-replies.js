/* =====================================================================
   "THANK YOU, AND SOMETHING WE OWED YOU" — 5 Oct 2026.
   Ty's call: everybody. He is the CEO and wants to be able to reach the
   whole room quickly; this is the pipe that does it.

   ⭐ TY'S BRIEF, SECOND PASS, VERBATIM: "more inviting and just thank
   them for being here when it was nothing together we can wear down the
   stigma of addiction by just being honest with each other and having
   fun on this app something like that keep it short and sweet".

   So: thanks is the email. Short. "Here when it was nothing" is his
   phrase and it is the best line in it. "Honest with each other and
   having fun" is the method — kept exactly, because "fun" is the word
   that keeps this from reading like a support group newsletter.

   ⚠️ THE NOTIFICATIONS FIX IS NOW ONE SENTENCE, not a section. Cutting
   it entirely was the other option and it is wrong: the fix is the
   REASON this fourth broadcast is allowed to exist at all (see the bar
   the admin page sets, below). A thank-you note with no reason attached
   is the "good idea" the admin page says is not good enough. One line
   and the link keeps the reason without making the email about it.

   🔴 A NEW KEY, NOT AN EDIT OF AN EXISTING ONE.
   broadcast_sends is keyed on (broadcast_key, member_id) and that pair is
   the only thing standing between a member and a duplicate. Reusing an
   old key would send to nobody — the rows already exist and the claim
   collides. Clearing those rows to "re-send" would delete the record that
   prevents a third send. New key; the old ones stay as history.

   ---------------------------------------------------------------------
   ⚠️ THIS IS THE FOURTH BROADCAST, AND THE ADMIN PAGE SET THE BAR.
   Its own closing paragraph: "Every further broadcast spends credibility
   we are running low on. The next one needs a better reason than a good
   idea." The 1 Sept walkthrough promised it was the only email like it;
   the survey broke that once and said so; tour2 broke it twice and said
   so. This one says so too, in one quiet line near the end, and gives a
   reason that is about them rather than about the product.

   ---------------------------------------------------------------------
   🔴 THE NUMBER I HAD WRONG, AND WHY THIS EMAIL CARRIES NONE.

   The 5 Oct prototype claimed members were sitting on "29.6 unread
   each, on average". That is 13,015 notifications divided by the member
   count — and 12,028 of those 13,015 rows are kind='highlight', OUR OWN
   past broadcasts. Counting them as people answering people is the same
   error as the 12,007 email false alarm: the wrong rows, and an alarming
   total.

   The honest figures: 340 unread replies/mentions/messages across 283
   members. ⭐ 1.2 each. Nobody has a pile; most have ONE reply.

   ⚠️ So this email states no count, and must not start. "You have 1
   unread notification" is a weak reason to open an app. Wording B on the
   card carries no number for the same reason.

   ⚠️ AND EVERY SENTENCE MUST BE TRUE FOR ALL 409 RECIPIENTS, not just
   the 275 with something waiting. 134 have never been answered by
   anyone. So the copy stays conditional — "if somebody answered you" —
   and never asserts that mail is sitting there. Telling 134 people they
   have replies they do not have is the "verified, real people" failure
   wearing a different hat.

   ⚠️ WARM IS NOT THE SAME AS FLATTERING. No "you're all amazing", no
   claims about what members have achieved, no numbers about the
   community's size or success. Thanks for showing up, and a shared aim.

   ⚠️ NO NUDGE. 130 members were promised no reminders, no streaks, no
   nudges to come back. No day counts, no "we miss you", no "look what
   you missed". Thanks, a thing we fixed, a door in, a door out.

   ⚠️ "Break the stigma" is Ty's line and it is a shared intention, not a
   claim that it has happened. Kept as "together", future tense.
   ===================================================================== */

export const REPLIES_BROADCAST_KEY = 'replies-unseen-2026-10-05';

export function repliesEmail({ optoutUrl }) {
  const subject = 'Thank you for being here';

  /* ⚠️ The plain-text part is not politeness. An HTML-only body is a spam
     signal, and some people read mail in clients that never render it. */
  const text = [
    'Hey —',
    '',
    'Quick one, and it is only to say thank you.',
    '',
    'You were here when this was nothing. A quiet room and a promise, and',
    'you took a chance on it anyway. I do not take that lightly.',
    '',
    'Recovery is still hard to talk about in most places — people lower',
    'their voice. I think we wear that down just by being honest with each',
    'other in here, and by having a bit of fun while we are at it. That is',
    'the whole idea.',
    '',
    'One small thing: when somebody replied to you, the app recorded it and',
    'almost never told you. That is fixed. Anything waiting for you is here:',
    '',
    '  https://soberbook.app/notifications',
    '',
    'Replies and messages only, if you want them. Nothing else, ever — no',
    'reminders, no streaks, no nudges to come back.',
    '',
    'Thank you, genuinely. Glad you are here.',
    '',
    'Ty',
    'CEO, Sober Book',
    'soberbook.app',
    '',
    '(Fourth email like this one — more than I said there would be. It goes',
    'quiet again now.)',
    '',
    'Stop all emails: ' + optoutUrl,
  ].join('\n');

  /* ⚠️ Inline styles only — Gmail strips <style> blocks. */
  const html = `
<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C2320;max-width:520px;margin:0 auto;padding:8px 4px;">
  <p style="margin:0 0 16px;">Hey &mdash;</p>
  <p style="margin:0 0 16px;">Quick one, and it&rsquo;s only to say <b>thank you</b>.</p>
  <p style="margin:0 0 16px;">You were here when this was nothing. A quiet room and a promise, and you took a chance on it anyway. I don&rsquo;t take that lightly.</p>
  <p style="margin:0 0 20px;">Recovery is still hard to talk about in most places &mdash; people lower their voice. I think we wear that down just by being honest with each other in here, and by having a bit of fun while we&rsquo;re at it. That&rsquo;s the whole idea.</p>
  <p style="margin:0 0 18px;">One small thing: when somebody replied to you, the app recorded it and almost never told you. That&rsquo;s fixed.</p>
  <p style="margin:0 0 20px;">
    <a href="https://soberbook.app/notifications" style="display:inline-block;background:#1B6B4A;color:#F7FAF8;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:10px;">See what&rsquo;s waiting</a>
  </p>
  <p style="margin:0 0 18px;">Replies and messages only, if you want them. Nothing else, ever &mdash; no reminders, no streaks, no nudges to come back.</p>
  <p style="margin:0 0 20px;">Thank you, genuinely. Glad you&rsquo;re here.</p>
  <p style="margin:0 0 18px;">Ty<br><span style="color:#63716A;font-size:14.5px;">CEO, Sober Book</span><br><a href="https://soberbook.app" style="color:#256F4C;">soberbook.app</a></p>
  <p style="margin:0;font-size:13px;color:#63716A;border-top:1px solid #DCE7E1;padding-top:14px;">
    Fourth email like this one &mdash; more than I said there&rsquo;d be. It goes quiet again now.
    <a href="${optoutUrl}" style="color:#63716A;">Stop all emails</a>.
  </p>
</div>`.trim();

  return { subject, html, text };
}
