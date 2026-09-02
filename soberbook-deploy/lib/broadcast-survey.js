/* =====================================================================
   THE SURVEY EMAIL. Kenny Kerns' idea, 2 Sept 2026.

   One email, to every member, about soberbook.app/survey.

   🔴 TY'S NOTE, AND IT IS THE POINT OF THE WHOLE EMAIL:
   "make sure people know we are humble and we are new on the block as a
    new app."

   So it says what is actually true — three people, a month old, building
   it at night, guessing at a lot of it. That is not self-deprecation as
   a technique. It is the accurate description, and it is also the only
   framing under which asking somebody for their time is reasonable.

   ⚠️ An earlier draft said "I'm still building most of it", which reads
   as one clever person and is no longer true anyway: Nic Rossiter and
   Kenneth Kerns came on as co-founders today. Saying "three of us" is
   both humbler and more accurate.

   ⚠️ AND IT MUST NOT SINGLE ANYBODY OUT. Most members have never posted.
   A line addressed to them specifically — however kindly meant — reads
   as being called out for it. So: "whether you're in there every day or
   you signed up and haven't been back", which includes them without
   pointing.

   ⚠️ NO NUDGE. 130 members were promised "no reminders, no streaks, no
   nudges to come back". No day counts, no "we miss you", no "see what's
   new". A question, and a door out.

   ⚠️ AND THE WALKTHROUGH EMAIL PROMISED, in its own footer, that it was
   "the only email like this you'll get from me". 151 people read that on
   1 Sept. This is the second. So it is acknowledged — once, in a
   parenthetical near the bottom — and then dropped.

   ⭐ THE MEMBER COUNT IS PASSED IN, NOT WRITTEN DOWN. The first version
   hardcoded 172 and the number was 176 four hours later. A figure baked
   into a template is wrong the moment anybody joins, and this email
   takes two days to send. The route reads it live at send time; if it
   somehow can't, the sentence drops the number rather than printing a
   stale one.

   🔴 AND FOR THE SAME REASON, IT NO LONGER SAYS "FOUR QUESTIONS".
   The survey BRANCHES: a member who answers "Not yet" to "have you
   posted" gets the extra "what would make it easier?" and sees four; a
   member who answers "Yes" skips it and sees three. There is no single
   true number, so the email states none — "a few". ⚠️ The count was
   correct when this template was written on 2 Sept and stopped being
   correct a few hours later when Q3b was deleted, which is exactly the
   failure mode the member-count note above is about. A number in an
   email is a promise you have to keep maintaining somewhere else.
   ===================================================================== */

export const SURVEY_BROADCAST_KEY = 'survey-sept-2026';

export function surveyEmail({ optoutUrl, memberCount }) {
  const subject = 'We’re new at this — what would you like to see?';

  /* ⚠️ No number rather than a wrong number. */
  const howMany = Number.isFinite(memberCount) && memberCount > 0
    ? `There are ${memberCount} of us in there now, and`
    : 'Everybody in there';

  /* ⚠️ The plain-text part is not politeness. An HTML-only body is a spam
     signal, and some people read mail in clients that never render it. */
  const text = [
    'Hey —',
    '',
    'Sober Book is about a month old. It is not a company — it is three of',
    'us building it at night, and a fair amount of it is guesswork.',
    '',
    `${howMany} you would all know better than we do what is missing.`,
    '',
    'So we are asking. A few quick questions, nothing tied to your name:',
    '',
    '  https://soberbook.app/survey',
    '',
    'Takes a minute. There are no wrong answers, and you can skip anything',
    "you want. Whether you're in there every day or you signed up and",
    "haven't been back, we'd like to know what you think.",
    '',
    '(I know I said the last email would be the only one — this is it, then',
    "I'll leave your inbox alone.)",
    '',
    'Thanks for being here this early. It matters more than you know.',
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
  <p style="margin:0 0 16px;">Sober Book is about a month old. It isn&rsquo;t a company &mdash; it&rsquo;s three of us building it at night, and a fair amount of it is guesswork.</p>
  <p style="margin:0 0 16px;">${howMany} you&rsquo;d all know better than we do what&rsquo;s missing.</p>
  <p style="margin:0 0 20px;">So we&rsquo;re asking. A few quick questions, nothing tied to your name:</p>
  <p style="margin:0 0 22px;">
    <a href="https://soberbook.app/survey" style="display:inline-block;background:#1B6B4A;color:#F7FAF8;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:10px;">Answer the questions</a>
  </p>
  <p style="margin:0 0 16px;">Takes a minute. There are no wrong answers, and you can skip anything you want. Whether you&rsquo;re in there every day or you signed up and haven&rsquo;t been back, we&rsquo;d like to know what you think.</p>
  <p style="margin:0 0 16px;color:#63716A;font-size:14.5px;">(I know I said the last email would be the only one &mdash; this is it, then I&rsquo;ll leave your inbox alone.)</p>
  <p style="margin:0 0 4px;">Thanks for being here this early. It matters more than you know.</p>
  <p style="margin:0 0 20px;">Ty<br><a href="https://soberbook.app" style="color:#256F4C;">soberbook.app</a></p>
  <p style="margin:0;font-size:13px;color:#63716A;border-top:1px solid #DCE7E1;padding-top:14px;">
    <a href="${optoutUrl}" style="color:#63716A;">Stop all emails</a>.
  </p>
</div>`.trim();

  return { subject, html, text };
}
