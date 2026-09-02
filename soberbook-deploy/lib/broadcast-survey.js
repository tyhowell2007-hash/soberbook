/* =====================================================================
   THE SURVEY EMAIL. Kenny Kerns' idea, 2 Sept 2026.

   One email, to every member, about soberbook.app/survey.

   🔴 WHAT THIS EMAIL HAS TO CARRY, and why the copy is the way it is.

   The walkthrough email said, in its own footer:

       "This is the only email like this you'll get from me. Otherwise
        Sober Book only ever emails you when an actual person has
        answered you."

   151 people read that on 1 Sept. This is the second one. So the
   sentence is acknowledged — once, in a parenthetical near the bottom,
   and then dropped.

   ⚠️ AN EARLIER DRAFT MADE THAT THE WHOLE EMAIL. Subject line "I said
   I'd only email you once. I'm breaking that, once." Ty read it and
   said: "We don't need to be so aggressive. Let's be just nice and easy
   with it." He was right, and for a better reason than tone — that
   version made the email about the founder and his broken promise
   instead of about the person reading it.

   ⚠️ AND IT MUST NOT SINGLE ANYBODY OUT. 138 of 172 members have never
   posted. A line addressed to them specifically — however kindly meant —
   reads as being called out for it. So the email says "whether you're in
   there every day or you signed up and haven't been back", which
   includes them without pointing.

   ⚠️ NO NUDGE. 130 members were promised "no reminders, no streaks, no
   nudges to come back". So: no day counts, no "we miss you", no "come
   see what's new". A question, and a door out.
   ===================================================================== */

export const SURVEY_BROADCAST_KEY = 'survey-sept-2026';

export function surveyEmail({ optoutUrl }) {
  const subject = 'What would you like to see in here?';

  /* ⚠️ The plain-text part is not politeness. An HTML-only body is a
     spam signal, and some people read mail in clients that never render
     the HTML at all. Same reasoning as the tour email. */
  const text = [
    'Hey —',
    '',
    'Sober Book is about a month old and there are 172 of us in there now.',
    "I'm still building most of it, which means a lot of what's in there is",
    'my best guess.',
    '',
    "I'd rather hear from you than keep guessing.",
    '',
    'Four quick questions, nothing tied to your name:',
    '',
    '  https://soberbook.app/survey',
    '',
    'Takes a minute. There are no wrong answers, and you can skip anything',
    "you want. Whether you're in there every day or you signed up and",
    "haven't been back, I'd like to know what you think.",
    '',
    '(I know I said the last email would be the only one — this is it, then',
    "I'll leave your inbox alone.)",
    '',
    'Thanks for being in there,',
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
  <p style="margin:0 0 16px;">Sober Book is about a month old and there are 172 of us in there now. I&rsquo;m still building most of it, which means a lot of what&rsquo;s in there is my best guess.</p>
  <p style="margin:0 0 16px;">I&rsquo;d rather hear from you than keep guessing.</p>
  <p style="margin:0 0 20px;">Four quick questions, nothing tied to your name:</p>
  <p style="margin:0 0 22px;">
    <a href="https://soberbook.app/survey" style="display:inline-block;background:#1B6B4A;color:#F7FAF8;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:10px;">Answer the four questions</a>
  </p>
  <p style="margin:0 0 16px;">Takes a minute. There are no wrong answers, and you can skip anything you want. Whether you&rsquo;re in there every day or you signed up and haven&rsquo;t been back, I&rsquo;d like to know what you think.</p>
  <p style="margin:0 0 16px;color:#63716A;font-size:14.5px;">(I know I said the last email would be the only one &mdash; this is it, then I&rsquo;ll leave your inbox alone.)</p>
  <p style="margin:0 0 4px;">Thanks for being in there,</p>
  <p style="margin:0 0 20px;">Ty<br><a href="https://soberbook.app" style="color:#256F4C;">soberbook.app</a></p>
  <p style="margin:0;font-size:13px;color:#63716A;border-top:1px solid #DCE7E1;padding-top:14px;">
    <a href="${optoutUrl}" style="color:#63716A;">Stop all emails</a>.
  </p>
</div>`.trim();

  return { subject, html, text };
}
