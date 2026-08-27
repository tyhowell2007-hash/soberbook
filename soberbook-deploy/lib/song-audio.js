/* =====================================================================
   ONE AUDIO ELEMENT FOR THE WHOLE APP, BLESSED ON THE FIRST TAP.

   Ty, Aug 23: autoplay worked on the laptop and never on his phone.
   "need to work like Myspace."

   ---------------------------------------------------------------------
   🔴 THE THING EVERYONE GETS WRONG ABOUT iOS AUTOPLAY.

   The usual summary is "iOS needs a user gesture to play audio". That is
   true and it is not the useful half. The useful half is:

       iOS blesses an ELEMENT, not a page and not a session.

   An <audio> element that has been played once from inside a real tap is
   unlocked FOR ITS ENTIRE LIFETIME. After that, script can set a new src
   and call play() whenever it likes and iOS allows it. An element that has
   never been touched by a tap is refused every single time, forever, no
   matter how much the person has interacted with the rest of the page.

   The old build gave every profile its own brand-new <audio>. So on a
   phone the answer was always no — not sometimes, always. On a laptop it
   worked, because desktop Chrome decides with a per-site engagement score
   instead of per-element blessing. ⭐ That difference is the entire bug,
   and it's why it looked like a phone problem rather than a code one.

   ---------------------------------------------------------------------
   ⭐ WHY A SINGLETON ACTUALLY SOLVES IT HERE.

   Sober Book is a single-page app. Tapping People, then a member, never
   reloads the document — so an element blessed on the sign-in screen is
   still blessed six screens later. One element, unlocked by the first tap
   anybody makes anywhere, and every profile after that just plays.

   ⚠️ THE ONE CASE THIS CANNOT FIX, stated plainly so nobody hunts for it:
   somebody cold-opening /u/someone as the very first thing they do, from
   a link outside the app, with no tap in between. There is no gesture to
   borrow. They get the ▶ button, which is why the ▶ button stays.

   ---------------------------------------------------------------------
   ⚠️ FIVE THINGS THAT BREAK THIS, ALL OF THEM SILENTLY.

   1. crossOrigin MUST be set before the FIRST src ever assigned — not
      before each one. That's why it's set at creation, above any caller.
      Get it wrong and the analyser reads an unbroken row of zeros while
      the sound plays fine: flat bars, no error, nothing in the console.
   2. createMediaElementSource runs ONCE per element, ever. Twice throws.
      A singleton makes that easy rather than fragile — wired once, kept.
   3. 🔴 NEVER close this AudioContext. A closed context cannot be
      reopened, and there is only one. The old per-instance player closed
      its context on unmount, which was correct when the context was also
      per-instance and would be catastrophic now — the first profile you
      left would kill sound for the rest of the session.
   4. The unlock must run INSIDE the gesture handler, synchronously
      enough that Safari still counts it. Not in a promise chain that
      resolves later, not after an await.
   5. touchend/click count as gestures on iOS. touchstart and pointerdown
      historically do NOT. Listening for the wrong one gets you a handler
      that fires and an element that stays locked.
   ===================================================================== */

/* 0.01s of true silence — 8kHz mono, 204 bytes, 80 real samples of
   nothing. Generated and then validated by decoding it back off disk, not
   copied from anywhere.

   🔴 IT HAS TO BE A GENUINELY VALID WAV. play() on a malformed source
   rejects, and if that play() is the unlock then the blessing never
   happens and this entire file does nothing. The first version of this
   line was silently TRUNCATED when it was written — header declaring 836
   bytes of audio over 714 real ones — and the build was green, because a
   build cannot tell you a base64 string is short. Checked with a decoder:
   RIFF/WAVE/fmt intact, declared size == real size, data chunk complete,
   every sample zero, byte-exact round trip.

   ⚠️ It is short partly so that truncation would be obvious next time.
   Do not "tidy" it by wrapping it across lines. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let el = null;          // the one element
let ctx = null;         // the one AudioContext
let an = null;          // the one analyser
let wired = false;      // createMediaElementSource has run
let blessed = false;    // a real tap has played this element at least once
let owner = null;       // which SongPlayer instance currently has the floor
const listeners = new Set();

function notify() { for (const f of listeners) { try { f(); } catch {} } }

/* Anything that wants to know when the floor changes hands. Returns its
   own unsubscribe, so a component can clean up without knowing anything
   about this module's internals. */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function element() {
  if (el) return el;
  el = new Audio();
  /* ⚠️ BEFORE any src is ever set on this element, including the silent
     one. This is gotcha 1 and it is the reason the element is created
     here rather than by whoever needs it first. */
  el.crossOrigin = 'anonymous';
  el.preload = 'none';
  el.addEventListener('play', notify);
  el.addEventListener('pause', notify);
  return el;
}

/* The analyser, built once. Returns null if Web Audio is unavailable —
   in which case the sound still plays, it just has no waveform. Losing
   the bars is a smaller loss than losing the song. */
export function analyser() {
  if (wired) return an;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    const src = ctx.createMediaElementSource(element());  // ⚠️ once, ever
    an = ctx.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.7;
    src.connect(an);
    an.connect(ctx.destination);   // ⚠️ forget this and you get silence
    wired = true;
    return an;
  } catch { wired = true; an = null; return null; }
}

export function isBlessed() { return blessed; }

/* =====================================================================
   THE UNLOCK. Called from a real tap, once per document.

   Plays 50ms of silence and immediately stops. That is the whole trick:
   afterwards iOS treats this element as one the person chose to play, and
   script may drive it for the rest of its life.

   ⚠️ NOT async before the play() call. Safari checks whether it is still
   inside the gesture when play() is invoked; an `await` before it hands
   back to the event loop and the gesture is gone. The awaits below all
   happen AFTER the call that matters.

   ⚠️ Wiring the analyser here too, in the same gesture, because
   resume()ing an AudioContext has the same requirement. If the context
   were left suspended the element would play into a stopped graph — and
   the failure looks exactly like success: no error, currentTime advances
   on some browsers, and nothing comes out of the speaker.
   ===================================================================== */
export function unlockFromGesture() {
  if (blessed) return;
  const a = element();
  try {
    analyser();                                   // build + connect the graph
    if (ctx && ctx.state === 'suspended') ctx.resume();   // no await before play
    a.src = SILENT_WAV;
    const p = a.play();
    blessed = true;              // optimistic; the catch below undoes it
    if (p && p.then) {
      p.then(() => { try { a.pause(); a.currentTime = 0; } catch {} notify(); })
       .catch((e) => {
         /* 🔴 AN ABORT IS NOT A REFUSAL — IT IS THE OPPOSITE.
            Caught Aug 26 by watching real play() calls: tapping ▶ makes the
            unlock and the song race for the SAME element, the song's src
            assignment counts as "a new load request", and that aborts the
            silent play still in flight:

              play()  src=data:audio/wav      ← unlock
              play()  src=…apple.com/…m4a     ← the song
              REJECTED  AbortError: interrupted by a new load request

            Treating that as failure set `blessed = false` — so the very act
            of pressing play un-blessed the element, and on iOS the next
            profile would then be skipped as "never unlocked." The element
            was played. It IS blessed. Only a real refusal un-blesses. */
         if (e && e.name === 'AbortError') { notify(); return; }
         blessed = false; notify();
       });
    } else {
      try { a.pause(); } catch {}
      notify();
    }
  } catch { blessed = false; }
}

/* =====================================================================
   THE FLOOR.

   /me renders TWO SongPlayers on one page (your anthem, and the preview
   while you're picking a new one). With a single shared element they
   would otherwise fight over it — one would start and the other would
   still be drawing a pause button over a song that is no longer theirs.

   So playback is claimed by key. Whoever plays last owns the element;
   everybody else is told, and renders as stopped. ⭐ This is honesty
   about a real constraint rather than a workaround: there is one speaker,
   so there is one song.
   ===================================================================== */
export function owns(key) { return owner === key && !!el && !el.paused; }
export function current() { return owner; }

export async function play(key, src, { loop = true } = {}) {
  const a = element();
  analyser();
  if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }

  /* Only touch src when it actually changes — reassigning the same URL
     restarts the download and audibly stutters a song that's already
     going. */
  if (a.src !== src) { a.src = src; }
  a.loop = loop;
  owner = key;
  notify();
  await a.play();          // throws if the element was never blessed
  blessed = true;          // it played, so by definition it is blessed now
}

export function pause(key) {
  if (key && owner !== key) return;   // not yours to stop
  try { element().pause(); } catch {}
  notify();
}

/* ⚠️ Releasing is NOT closing. Leaving a profile stops the song and hands
   the floor back — it must never close the context (gotcha 3) and must
   never null the element, because the blessing lives on that object and
   throwing it away would lock the app's audio for the rest of the
   session. There is deliberately no dispose() in this module. */
export function release(key) {
  if (owner !== key) return;
  pause(key);
  owner = null;
  notify();
}
