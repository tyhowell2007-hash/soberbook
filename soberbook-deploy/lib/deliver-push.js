import { sendApns } from './apns';
import { pushWords, PUSH_TITLE } from './push-words';

/* =====================================================================
   ONE PLACE THAT DELIVERS TO A MEMBER'S DEVICES.  31 Oct 2026.

   Called by /api/push/send (every member alert) and /api/report/triage
   (admin alerts). Before tonight each route had its own web-push loop;
   adding iPhone-app delivery to both would have been the restatement
   this codebase keeps getting burned by. Now they both call this.

   A row whose endpoint starts with 'apns:' is the iPhone app (lib/apns.js).
   Every other row is a website subscription (web-push, as before).

   Bookkeeping is the same for both kinds, unchanged from the old loop:
   a device that is GONE (404/410, or Apple's Unregistered) is deleted at
   once; any other failure is counted, and the tenth in a row retires it.
   One bad ten minutes at a push service never costs somebody their alerts.
   ===================================================================== */

export async function deliverPush(admin, subs, rawTo) {
  const { to, body, urgent } = pushWords(rawTo);
  const web = subs.filter((s) => !String(s.endpoint).startsWith('apns:'));
  const ios = subs.filter((s) => String(s.endpoint).startsWith('apns:'));

  const dead = [];
  const bumped = [];
  let ok = 0;
  /* What Apple said, per iPhone — status and reason only, never a token.
     Shows up in the route's reply (net._http_response) for debugging. */
  const iphone = [];

  if (web.length) {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:ty.howell2007@gmail.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    /* ⚠️ The website payload is STILL a path only — sw.js picks the words. */
    const payload = JSON.stringify({ to });
    await Promise.all(web.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        ok++;
      } catch (e) {
        const code = e?.statusCode;
        if (code === 404 || code === 410 || (s.failures ?? 0) >= 9) dead.push(s.id);
        else bumped.push(s);
      }
    }));
  }

  if (ios.length) {
    const res = await sendApns(ios.map((s) => s.endpoint.slice(5)), { title: PUSH_TITLE, body, to, urgent });
    res.forEach((r, i) => {
      const s = ios[i];
      iphone.push(r.ok ? 'ok' : `${r.status || ''} ${r.reason || ''}`.trim());
      if (r.ok) ok++;
      else if (r.ours) { /* our key's fault, not theirs — leave the row alone */ }
      else if (r.dead || (s.failures ?? 0) >= 9) dead.push(s.id);
      else bumped.push(s);
    });
  }

  for (const s of bumped) {
    await admin.from('push_subscriptions').update({ failures: (s.failures ?? 0) + 1 }).eq('id', s.id);
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);

  return { ok, retired: dead.length, iphone };
}
