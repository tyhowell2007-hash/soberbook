/* =====================================================================
   TURNING THE BUZZ ON — THE ONE IMPLEMENTATION.  Aug 30.

   ⭐ WHY THIS FILE EXISTS. Until tonight this lived entirely inside
   PushSwitch, the control at the bottom of /me. Tonight a second caller
   appeared — the card that asks right after somebody's first post — and
   the tempting move was to copy the twenty lines across.

   🔴 That is the mistake this app has made four times: 0046 → 0047 →
   0049 (the send cap restated in a second place and drifting), and again
   on the 28th when a field was renamed in the producer and not in the
   consumer. **A restatement is a second implementation, and the second
   one drifts.** Everything hard-won in here — userVisibleOnly, the
   base64 padding, the deliberate absence of `failures` — would have had
   to be discovered twice.

   So: PushSwitch and PushAsk both call these functions. Neither knows
   how a subscription is made.
   ===================================================================== */

/* The VAPID public key travels as url-safe base64 and the Push API wants
   raw bytes. ⚠️ Getting the padding wrong fails with an opaque
   DOMException that says nothing about padding. */
function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/* Can this device do it at all, and if not, say WHICH thing is missing.
   ⚠️ On an iPhone the answer is almost always "you haven't added it to
   your home screen" — Apple only delivers web push to a PWA installed
   via Share → Add to Home Screen. That's fixable in ten seconds, and
   "notifications aren't supported" would send somebody away believing it
   was impossible. */
export function pushSupport() {
  if (typeof window === 'undefined') return { supported: false, why: '' };
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ok) return { supported: true, why: '' };
  const iOSish = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return {
    supported: false,
    why: iOSish
      ? 'On iPhone, notifications only work once Sober Book is on your home screen. Tap Share, then Add to Home Screen, and open it from there.'
      : 'This browser can’t do notifications.',
  };
}

/* 🔴 "ON" MEANS THE SERVER HAS THIS DEVICE — NOT THAT THE BROWSER
   SUBSCRIBED. On Aug 26 the switch read "Turn it off" while
   push_subscriptions was completely empty: the browser held a
   subscription from a failed attempt, the row had never saved, and the
   control insisted notifications were working. A subscription the server
   has never seen receives nothing, forever. Both have to agree. */
export async function currentPushState(supabase) {
  const { supported } = pushSupport();
  if (!supported) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return 'off';

  const { data: rows } = await supabase
    .from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).limit(1);
  return rows && rows.length ? 'on' : 'off';
}

/**
 * Ask the browser, then register the device with the server.
 *
 * ⚠️ THIS SPENDS THE ONE PERMISSION. A browser remembers "no" forever and
 * on iOS you cannot ask a second time — so this must only ever be called
 * from a deliberate tap on a control that has already explained itself.
 * Never on page load, never speculatively.
 *
 * @returns {{state:'on'|'off'|'blocked'|'unsupported', why:string}}
 */
export async function enablePush(supabase) {
  const { supported, why: unsupportedWhy } = pushSupport();
  if (!supported) return { state: 'unsupported', why: unsupportedWhy };

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return { state: perm === 'denied' ? 'blocked' : 'off', why: '' };
    }

    const reg = await navigator.serviceWorker.ready;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return { state: 'off', why: 'Notifications aren’t switched on yet.' };

    const sub = await reg.pushManager.subscribe({
      /* ⚠️ REQUIRED to be true, and not a formality: Chrome refuses a
         subscription that reserves the right to wake the device without
         showing anything. A silent push is spyware and the browser
         treats it that way. */
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key),
    });

    const j = sub.toJSON();
    const { data: { user } } = await supabase.auth.getUser();

    /* ⭐ Straight into the table, no API route. RLS already says a row
       must carry your own id, so the database is the check — a route
       would just be a second place to get that wrong.

       ⚠️ `failures` is NOT sent, and its absence is the point. It used to
       be here as `failures: 0` and cost an hour: the column grant covers
       the four credential columns, and a column-level grant refuses the
       WHOLE statement if one column isn't in it. The error is the same
       unhelpful "permission denied for table push_subscriptions" whether
       one column is missing or every column is. It defaults to 0, and the
       send route resets it after a successful delivery. The browser has
       no business writing the server's own bookkeeping. */
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
    }, { onConflict: 'endpoint' });
    if (error) throw error;

    return { state: 'on', why: '' };
  } catch (e) {
    return { state: 'off', why: e?.message || 'That didn’t work.' };
  }
}

/* ⚠️ Delete the row FIRST. If unsubscribe() succeeds and the row
   survives, the server keeps pushing at a dead endpoint until the failure
   counter retires it — the person asked for quiet and would get buzzed
   anyway. */
export async function disablePush(supabase) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* either way the answer they wanted is "off" */ }
  return 'off';
}
