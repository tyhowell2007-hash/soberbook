'use client';

import { useState, useEffect } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { shareInvite, INVITE_URL } from '../../lib/invite';

/* =====================================================================
   "IS THERE ONE PERSON YOU'D WANT IN HERE WITH YOU?"  — 9 Sept.

   Shown ONCE, ever, after somebody has been replied to. The wall asks the
   database (invite_ask_due) whether this person qualifies; this component
   only draws the card.

   ---------------------------------------------------------------------
   🔴 WHY IT EXISTS, AND THE NUMBER IS THE ARGUMENT. 245 members. 50 have
   ever said anything anywhere — and **39 of those 50 said it on the day
   they joined.** In thirty-seven days exactly eleven people have ever
   broken their silence on a later day: one every three days out of a
   hundred and ninety-five silent ones.

   So the room does not warm strangers up, and pouring more strangers in
   reproduces the same 20% forever. ⭐ This is the only channel we have
   where the new person arrives ALREADY KNOWING SOMEBODY — which is not a
   growth trick, it is a direct attack on the reason nobody speaks.

   ---------------------------------------------------------------------
   ⚠️ THE TRIGGER IS "SOMEBODY ANSWERED YOU", NOT "YOU POSTED".

   PushAsk already owns the first post and stacking two asks on one moment
   is a mugging. And a reply is the moment the app has actually PROVED
   itself — a human answered. That is when you'd want somebody you know in
   here, not thirty seconds after typing into what still looks like a void.

   ⚠️ ONE ASK, EVER, whichever way it goes — including "Not now", and
   including an outright failure. 130 members were emailed a promise of no
   reminders, no streaks and no nudges to come back. A card that returns
   next week is a nudge wearing a different hat, and it would be the
   sentence somebody trusted us on.

   🔴 THE TWO BUTTONS ARE THE SAME SIZE. Copied from PushAsk on purpose.
   ===================================================================== */
export default function InviteAsk() {
  const [state, setState] = useState('ask');   // ask | busy | shared | copied | manual | no
  const [show, setShow] = useState(false);

  /* ⭐ IT DECIDES FOR ITSELF, AND THE WALL KEEPS NO STATE ABOUT IT.
     Copied from the walkthrough card rather than from PushAsk, and the
     difference matters: PushAsk is triggered by an ACTION (you just
     posted), so the wall knows the moment it happens and holds a flag.
     "Somebody replied to you" happened at some other time, on somebody
     else's phone — there is no event here to hang it off. So this asks on
     mount and renders nothing unless the answer is a definite yes.

     ⚠️ `=== true` on purpose, not a truthy check. A failed RPC returns
     undefined and `if (data)` would be false anyway — but an RPC that
     ever came back with a string or a row would sail through a truthy
     test and put this card in front of somebody who was never due it.

     ⚠️ Fails silently and returns null. If this errors, Home loses a
     card. It must never lose the wall — the same stance as the open-room
     read and signPhotoPaths degrading to no-photos rather than 500ing. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await browserClient().rpc('invite_ask_due');
        if (alive && data === true) setShow(true);
      } catch { /* no card, and the wall is fine */ }
    })();
    return () => { alive = false; };
  }, []);

  /* ⚠️ Marks the ask SPENT before anything else can go wrong, and never
     blocks on it. Idempotent in the database (invite_ask_done's WHERE
     clause), so a double render still counts as one ask. */
  async function spend() {
    try { await browserClient().rpc('invite_ask_done'); } catch { /* not worth blocking a member on */ }
  }

  async function go() {
    setState('busy');
    /* 🔴 shareInvite() FIRST, spend() SECOND — and the order is load-
       bearing on iOS. Awaiting the network before calling navigator.share
       spends the user gesture, and the share sheet is then refused. Same
       class of bug as the audio unlock: the tap is a budget, not a flag. */
    const r = await shareInvite();
    /* ⚠️ A cancel is a decision, not an answer. They opened the sheet,
       looked at their own contacts and thought better of it — leaving the
       card up lets them try again in the same sitting, and the ask stays
       unspent so the one shot isn't wasted on a change of mind. */
    if (r === 'cancelled') { setState('ask'); return; }
    await spend();
    setState(r);
  }

  async function notNow() {
    await spend();
    setState('no');
  }

  /* ⚠️ THE GUARD SITS HERE, BELOW EVERY DECLARATION, NOT UP WITH THE
     HOOKS. It has to come after the useState/useEffect calls (an early
     return above a hook changes the hook order between renders, which
     React refuses) — but putting it above `go` and `notNow` only works
     because function declarations hoist. The day somebody rewrites one as
     `const go = async () => …` that becomes a white screen with a green
     build, which is the exact bug check-tdz.py exists to catch. Below
     everything, it cannot rot that way. */
  if (!show) return null;

  if (state === 'no') {
    return (
      <div className="ivcard">
        <span className="ivTtl">No problem.</span>
        {/* 🔴 THIS LINE USED TO READ "there's a link at the bottom of your
            page whenever you want it" — AND THAT WAS NOT TRUE YET. The
            /me line is drawn and its CSS is written (.ivMe* in
            invite.css) and the component does not exist, so the card
            would have been sending people to a place with nothing in it.

            ⚠️ The CSS-coverage check did NOT catch this and could not:
            it proves every class a route RENDERS has a rule, not that
            every rule has a renderer. An unused block passes silently.

            ⭐ The app does not make a promise it hasn't built — the same
            rule that killed "verified, real people" and the drop card
            reading "Sober Book first" over an already-released song. When
            the /me line ships, this sentence can point at it. */}
        <span className="ivBody">If you think of somebody later, just send them soberbook.app.</span>
      </div>
    );
  }

  if (state === 'shared' || state === 'copied') {
    return (
      <div className="ivcard">
        <span className="ivTtl">{state === 'shared' ? 'Sent.' : 'Copied.'}</span>
        <span className="ivBody">
          {state === 'shared'
            ? 'Thanks — that’s the best thing anybody can do for this place.'
            : 'Paste it wherever you normally talk to them.'}
        </span>
      </div>
    );
  }

  return (
    <div className="ivcard">
      <span className="ivEyebrow">Somebody answered you</span>
      <span className="ivTtl">Is there one person you&rsquo;d want in here with you?</span>
      <span className="ivBody">
        This place is better when somebody you know is in it.
      </span>
      {/* 🔴 THIS SENTENCE IS A PROMISE THE CODE KEEPS. Nothing is sent
          from here: shareInvite() hands the text to the phone's own share
          sheet, the member picks the person, and the browser tells us
          nothing but "shared" or "cancelled". There is no contact upload
          and there never will be. If that ever stops being true, this
          line becomes a lie and it is the line they acted on. */}
      <span className="ivFine">
        Nothing gets sent from here, and we never see who you send it to.
      </span>

      <div className="ivRow">
        <button type="button" className="ivBtn go" onClick={go} disabled={state === 'busy'}>
          {state === 'busy' ? 'One second…' : 'Send a link'}
        </button>
        <button type="button" className="ivBtn no" onClick={notNow} disabled={state === 'busy'}>
          Not now
        </button>
      </div>

      {/* Both routes refused — show the address rather than leave a dead
          button. `readOnly` not `disabled`: a disabled input cannot be
          selected, which would defeat the entire point of showing it. */}
      {state === 'manual' && (
        <input className="ivLink" readOnly value={INVITE_URL}
               onFocus={(e) => e.target.select()}
               aria-label="Your invite link, ready to copy" />
      )}
    </div>
  );
}
