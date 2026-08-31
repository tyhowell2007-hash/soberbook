'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { pushSupport, currentPushState, enablePush, disablePush } from '../../lib/push';

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

/* ⚠️ 30 AUG — THE MECHANICS MOVED TO lib/push.js AND WERE NOT COPIED.

   A second caller appeared tonight (PushAsk, the card after somebody's
   first post) and the tempting move was to duplicate the subscribe code.
   That is the 0046 → 0047 → 0049 mistake: a restatement is a second
   implementation and the second one drifts. Everything hard-won —
   userVisibleOnly, the base64 padding, the deliberate absence of
   `failures` from the upsert — now exists once. This file draws a
   switch; it does not know how a subscription is made. */

export default function PushSwitch() {
  const [state, setState] = useState('checking');   // checking|off|on|busy|unsupported|blocked
  const [why, setWhy] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const { supported, why: w } = pushSupport();
      if (!supported) { setWhy(w); setState('unsupported'); return; }
      /* 🔴 currentPushState asks BOTH the browser and the server, and
         only says "on" when they agree — see the note in lib/push.js
         about the Aug 26 switch that read "Turn it off" while
         push_subscriptions was completely empty. */
      setState(await currentPushState(browserClient()));
    })();
  }, []);

  async function turnOn() {
    setState('busy'); setWhy('');
    const { state: s, why: w } = await enablePush(browserClient());
    setWhy(w); setState(s);
  }

  async function turnOff() {
    /* ⚠️ Clear the last failure before trying again. A message from a
       previous attempt sitting under a button you just pressed reads as a
       fresh failure — it sent me chasing a bug that was already fixed
       twice tonight. */
    setWhy('');
    setState('busy');
    setState(await disablePush(browserClient()));
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
