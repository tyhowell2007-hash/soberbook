/* =====================================================================
   SENDING MAIL — THE ONE IMPLEMENTATION.  31 Aug.

   ⚠️ SERVER ONLY. This holds the Resend API key. Importing it from a
   'use client' file would compile the key into a JavaScript bundle that
   every browser downloads. Same rule as lib/supabase-admin.js.

   ---------------------------------------------------------------------
   ⭐ WHY RESEND'S HTTP API AND NOT SMTP, when Supabase already sends auth
   mail over SMTP to the same account.

   SMTP is a conversation — connect, EHLO, STARTTLS, AUTH, MAIL FROM,
   RCPT TO, DATA, QUIT. It assumes a process that stays alive. A Vercel
   function is frozen the moment it responds, so a half-open SMTP socket
   is left dangling and the next invocation starts from nothing. One HTTP
   POST has no state to leave behind.

   The domain, DKIM, SPF, the return path and DMARC were all set up on
   26 Aug and are shared — this uses the same verified sender that was
   proven to land in Gmail's inbox rather than spam.
   ===================================================================== */

const ENDPOINT = 'https://api.resend.com/emails';

/* ⚠️ The from-address is not a preference. It has to be on soberbook.app
   or the DKIM signature won't match the domain and the mail goes to
   spam — which is precisely the 18-day silent failure that ended on
   26 Aug, when this was Ty's personal Gmail. */
const FROM = 'Sober Book <hello@soberbook.app>';

/**
 * Send one email. Returns { ok, id, error } and NEVER throws.
 *
 * 🔴 It never throws on purpose. The caller is a loop over a batch of
 * people; one bad address must not stop the other forty-nine from being
 * told that somebody answered them.
 */
export async function sendMail({ to, subject, html, text, headers }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'no RESEND_API_KEY' };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        /* ⚠️ A plain-text part is not optional politeness. A message with
           only an HTML body is a well-known spam signal, and some clients
           (and every screen reader in a stripped-down mail app) show the
           text part instead. */
        text,
        headers,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}` };
    return { ok: true, id: body?.id };
  } catch (e) {
    return { ok: false, error: e?.message || 'send failed' };
  }
}

/* =====================================================================
   THE ONE EMAIL THIS APP SENDS.

   🔴 IT SAYS ALMOST NOTHING, AND THAT IS THE DESIGN.

   No name. No excerpt. No hint of the topic. Not because there's nothing
   to say, but because of where this lands: an inbox that may be shared
   with a partner, open on a work laptop, or read by a parent. The bell
   inside the app can show who answered and quote the post, because you
   had to unlock a phone and sign in to see it. An email has no such
   door in front of it.

   ⚠️ The sender name is the one thing we cannot strip — "Sober Book" has
   to appear, because the address must be soberbook.app for DKIM. Ty was
   told this explicitly before agreeing to have it on by default. Given
   that, every other word is chosen to add nothing on top of it.

   ⭐ The subject line gets the same treatment as the push body, which is
   a constant string in the service worker for exactly this reason.
   ===================================================================== */
export function answeredEmail({ optoutUrl, kind }) {
  /* ⚠️ One subject for replies and mentions, one for messages, and
     neither says who or what. "Nic replied to your post about last
     night" would be a disaster on a lock screen. */
  const subject = kind === 'message'
    ? 'You have a message'
    : 'Somebody answered you';

  const lead = kind === 'message'
    ? 'Someone sent you a message.'
    : 'Somebody answered you.';

  const body = kind === 'message'
    ? 'It’s waiting for you when you want it.'
    : 'Someone replied to something you posted. It’s there when you want it.';

  const text = [
    lead,
    '',
    body,
    '',
    'Go and see: https://soberbook.app/notifications',
    '',
    'We only email when a real person answers you or sends you a message.',
    'Never anything else — no reminders, no digests, no nudges to come back.',
    '',
    `Turn these off (one tap, no sign-in): ${optoutUrl}`,
  ].join('\n');

  /* Inline styles throughout — every mail client strips <style> blocks,
     and half of them strip <head> entirely. */
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#EDF3F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDF3F0;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#F7FAF8;border:1px solid #DCE7E1;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr><td style="background:#1B6B4A;padding:18px 22px;">
          <span style="color:#ffffff;font-size:15px;font-weight:600;">Sober Book</span>
        </td></tr>
        <tr><td style="padding:24px 22px;">
          <p style="margin:0 0 14px;font-size:17px;color:#0F3D2A;font-weight:600;">${lead}</p>
          <p style="margin:0 0 22px;font-size:14px;color:#1C2320;line-height:1.65;">${body}</p>
          <a href="https://soberbook.app/notifications"
             style="display:inline-block;background:#1B6B4A;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:14px;font-weight:600;">Go and see</a>
          <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #DCE7E1;font-size:12px;color:#63716A;line-height:1.7;">
            We only email when a real person answers you or sends you a message.
            Never anything else &mdash; no reminders, no digests, no nudges to come back.
            <br><br>
            <a href="${optoutUrl}" style="color:#256F4C;">Turn these off</a> &mdash; one tap, no sign-in needed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
