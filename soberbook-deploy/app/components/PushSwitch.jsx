'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   TURN THE BUZZ ON  (0073).

   ---------------------------------------------------------------------
   ⚠️ IT NEVER ASKS UNTIL YOU TAP IT.

   The standard move is a permission popup the moment somebody lands. It
   is also the single fastest way to get permanently denied: a browser
   remembers a "no" forever, and on iOS you cannot ask twice. So the
   prompt only appears after a deliberate tap on a control that has
   already explained itself.

   ---------------------------------------------------------------------
   🔴 ON AN IPHONE THIS DOES NOTHING UNLESS THE APP IS ON THE HOME SCREEN.

   Apple only delivers web push to a PWA installed via Safari → Share →
   Add to Home Screen. Opened as a normal website, the request silently
   fails or is never granted, and the person is left thinking the feature
   is broken. That is exactly the failure this app keeps hitting from the
   other side — something that looks fine and quietly does nothing — so
   the requirement is stated ON THE CONTROL, before they tap, rather than
   in a help page nobody opens.

   `navigator.standalone` is the iOS-only flag for "launched from the home
   screen". It's non-standard and absent everywhere else, which is why it
   is read defensively.
   ===================================================================== */

function urlB64ToUint8Array(base64) {
  /* The VAPID public key travels as url-safe base64 and the Push API
     wants raw bytes. ⚠️ Getting the padding wrong here fails with an
     opaque DOMException that says nothing about padding. */
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSwitch() {
  const [state, setState] = useState('checking');   // checking|off|on|busy|unsupported|blocked
  const [why, setWhy] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const supported = 'serviceWorker' in navigator && 'PushManager' in window
                        && 'Notification' in window;
      if (!supported) {
        /* ⚠️ Say WHICH thing is missing rather than "not supported". On an
           iPhone in Safari the answer is almost always "you haven't added
           it to your home screen", and that is fixable in ten seconds. */
        const iOSish = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setWhy(iOSish
          ? 'On iPhone, notifications only work once Sober Book is on your home screen. Tap Share, then Add to Home Screen, and open it from there.'
          : 'This browser can’t do notifications.');
        setState('unsupported'); return;
      }
      if (Notification.permission === 'denied') { setState('blocked'); return; }

      /* 🔴 "ON" MEANS THE SERVER HAS THIS DEVICE — NOT THAT THE BROWSER
         SUBSCRIBED.

         The first version asked only the browser. On Aug 26 that produced
         a switch reading "Turn it off" while push_subscriptions was
         completely empty: the browser had a subscription from a failed
         attempt, the row had never saved, and the control cheerfully
         insisted notifications were working. A subscription the server
         has never seen receives nothing, forever.

         ⚠️ Both have to agree. A browser subscription the database
         doesn't know about is treated as OFF, so tapping the button
         re-registers it instead of doing nothing. */
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) { setState('off'); return; }

      const supabase = browserClient();
      const { data: rows } = await supabase
        .from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).limit(1);
      setState(rows && rows.length ? 'on' : 'off');
    })();
  }, []);

  async function turnOn() {
    setState('busy'); setWhy('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return; }

      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) { setWhy('Notifications aren’t switched on yet.'); setState('off'); return; }

      const sub = await reg.pushManager.subscribe({
        /* ⚠️ REQUIRED to be true, and it is not a formality: Chrome
           refuses a subscription that reserves the right to wake the
           device without showing anything. A silent push is spyware and
           the browser treats it that way. */
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });

      const j = sub.toJSON();
      const supabase = browserClient();
      const { data: { user } } = await supabase.auth.getUser();
      /* ⭐ Straight into the table, no API route. RLS already says a row
         must carry your own id, so the database is the check — a route
         would just be a second place to get that wrong. */
      /* ⚠️ `failures` is NOT sent, and its absence is the point.

         It used to be here as `failures: 0` and it cost an hour: the
         column grant covers the four credential columns, and a
         column-level grant refuses the WHOLE statement if one column
         isn't in it. The error is the same unhelpful "permission denied
         for table push_subscriptions" whether one column is missing or
         every column is — so each fix looked like it had failed.

         It defaults to 0 on insert, and the send route resets it after a
         successful delivery. The browser has no business writing the
         server's own bookkeeping. */
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      setState('on');
    } catch (e) {
      setWhy(e?.message || 'That didn’t work.');
      setState('off');
    }
  }

  async function turnOff() {
    /* ⚠️ Clear the last failure before trying again. A message from a
       previous attempt sitting under a button you just pressed reads as a
       fresh failure — it sent me chasing a bug that was already fixed
       twice tonight. */
    setWhy('');
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const supabase = browserClient();
        /* ⚠️ Delete the row FIRST. If unsubscribe() succeeds and the row
           survives, the server keeps pushing at a dead endpoint until the
           failure counter retires it — the person asked for quiet and
           would get buzzed anyway. */
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
    } catch { setState('off'); }
  }

  if (state === 'checking') return null;

  return (
    <div className="pushbox">
      <h3 className="pushh">Buzz my phone</h3>
      <p className="pushp">
        When somebody answers you, sends you a message, or asks to be your
        friend. <strong>It never says who, or what they wrote</strong> — just
        that somebody did. You open the app to see.
      </p>

      {state === 'unsupported' && <p className="pushwhy">{why}</p>}

      {state === 'blocked' && (
        <p className="pushwhy">
          Your phone is blocking notifications for Sober Book. You’d have to
          turn them back on in your browser settings — we can’t ask again
          from here.
        </p>
      )}

      {(state === 'off' || state === 'busy') && state !== 'unsupported' && (
        <>
          <button type="button" className="btn" disabled={state === 'busy'}
                  onClick={turnOn}>
            {state === 'busy' ? 'One second…' : 'Turn it on'}
          </button>
          {why && <p className="pushwhy">{why}</p>}
        </>
      )}

      {state === 'on' && (
        <>
          <p className="pushon">On for this phone.</p>
          <button type="button" className="btn out" onClick={turnOff}>Turn it off</button>
        </>
      )}
    </div>
  );
}
