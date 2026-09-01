'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { enablePush, pushSupport } from '../../lib/push';

/* =====================================================================
   "WANT US TO TELL YOU WHEN SOMEBODY ANSWERS?"  — Aug 30.

   Shown ONCE, immediately after a member's very first post. The wall
   asks the database (push_ask_due) whether this person qualifies; this
   component only draws the card.

   ---------------------------------------------------------------------
   🔴 WHY IT EXISTS. Measured tonight: 114 members, and **3 of them could
   receive a notification**. Twenty notifications fired in 24 hours to
   fourteen people and almost none of them arrived, because the switch
   lives at the bottom of /me and nobody scrolls there. Eleven people had
   somebody answer their post yesterday and don't know it happened. That
   is why the room looks quiet when it isn't.

   ---------------------------------------------------------------------
   ⭐ THIS IS A SOFT ASK. IT IS THE ENTIRE DESIGN.

   The browser permission is a single non-renewable resource: a "no" is
   remembered forever, and on iOS there is no second chance. So this card
   is a pre-prompt — **"Not now" never touches the browser.** Only "Yes,
   tell me" calls enablePush(), which is the thing that spends the one
   shot. A person who isn't sure today can be asked again in a month; a
   person who met a raw browser popup on arrival is gone for good.

   ⚠️ THE TWO BUTTONS ARE THE SAME SIZE. A big green Yes over a small
   grey "no thanks" is the standard growth pattern and it is a dark one.
   This is a room for people who have been leaned on enough.

   ⚠️ THE COPY PROMISES A LIMIT AND WE HAVE TO KEEP IT. "Replies and
   messages only. Nothing else, ever." No streaks, no "we miss you", no
   re-engagement. If a future notification kind is added that isn't a
   person answering a person, this sentence becomes a lie and it is the
   sentence somebody said yes to.
   ===================================================================== */

/* ⚠️ `intro` IS A PROP AND NOT A SECOND COMPONENT.
   31 Aug: this card now renders in two places — after a first post on
   the wall, and on the bell when somebody has actually been answered.
   Only the opening line differs ("That's up there now." is nonsense on
   the bell). Forking the file would give us two copies of the soft-ask
   rules, and this codebase has three separate scars from a rule being
   restated somewhere else and drifting (0046 → 0047 → 0049). One
   component, one sentence swapped. */
export default function PushAsk({ onDone, intro = 'That’s up there now.' }) {
  const [state, setState] = useState('ask');   // ask | busy | on | blocked | unsupported | no
  const [why, setWhy] = useState('');

  /* ⚠️ Marks the ask as SPENT whichever way it goes, including "Not now"
     and including an outright failure. The card is a one-time
     interruption; showing it again the next time they post would turn a
     considerate question into nagging. The permission itself is
     untouched by a no, so they lose nothing — the switch on /me is still
     there, and the closing line says so. */
  async function spend() {
    try { await browserClient().rpc('push_ask_done'); } catch { /* not worth blocking on */ }
    if (onDone) onDone();
  }

  async function yes() {
    setState('busy'); setWhy('');
    const supabase = browserClient();
    const { state: s, why: w } = await enablePush(supabase);
    await spend();
    setWhy(w || '');
    setState(s === 'on' ? 'on' : s === 'blocked' ? 'blocked' : s === 'unsupported' ? 'unsupported' : 'no');
  }

  async function notNow() {
    await spend();
    setState('no');
  }

  /* ⚠️ Checked at render, not on mount. If the device can't do push at
     all there is nothing to ask for, and a card offering something
     impossible is worse than no card — it's the app promising a thing it
     cannot deliver. On an iPhone not yet on the home screen we say so
     plainly, because that is a ten-second fix and not a dead end. */
  const { supported, why: unsupportedWhy } = pushSupport();

  if (state === 'ask' && !supported) {
    return (
      <div className="pask">
        <p className="paskh">{intro}</p>
        <p className="paskp">{unsupportedWhy}</p>
        <button type="button" className="paskbtn ghost" onClick={notNow}>Got it</button>
      </div>
    );
  }

  if (state === 'on') {
    return (
      <div className="pask">
        <p className="paskp"><strong>Done.</strong> We’ll tell you when somebody answers.</p>
      </div>
    );
  }

  if (state === 'no' || state === 'blocked' || state === 'unsupported') {
    return (
      <div className="pask">
        <p className="paskp">
          {state === 'blocked'
            ? 'Your phone is blocking notifications for Sober Book — you’d have to turn them back on in your browser settings.'
            : 'No problem. It’s at the bottom of your own page whenever you want it.'}
        </p>
        {why && <p className="paskwhy">{why}</p>}
      </div>
    );
  }

  return (
    <div className="pask">
      <p className="paskh">That’s up there now.</p>
      <p className="paskq">Want us to tell you when somebody answers?</p>
      <p className="paskp">
        Replies and messages only. Nothing else, ever — no reminders, no
        streaks, no nudges to come back.
      </p>
      <button type="button" className="paskbtn go" disabled={state === 'busy'} onClick={yes}>
        {state === 'busy' ? 'One second…' : 'Yes, tell me'}
      </button>
      <button type="button" className="paskbtn ghost" disabled={state === 'busy'} onClick={notNow}>
        Not now
      </button>
    </div>
  );
}
