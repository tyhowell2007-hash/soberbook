'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import { makeHandles, createProfile, cleanHandle } from '../../lib/first-run';
import DatePick from '../components/DatePick';

/* =====================================================================
   THE FRONT DOOR — Ty's warm landing, with real doors in it.

   Aug 23. Ty: "I want this exact look, but with this sign in box."
   The look is _archive/soberbook 2/landing-warm.html. The boxes are the
   sign-in / new-here pair. This page is those two joined, and it is the
   ONLY landing page now — soberbook.app rewrites here.

   🔴 WHY, AND IT COST REAL MEMBERS.
   He showed Sober Book to people who loved it. They tapped "Go in" and
   met "Welcome back · sign in to pick up where you left off" — a
   password box they had never set. They left and reported it as "the
   old version". ⭐ A locked door and a stale build look identical from
   outside, and nobody files a bug saying "I couldn't work out how to
   join."

   ⚠️ This replaces the three doors (Aug 15). Acid slab for strangers,
   cream for returners, green inside — a good idea that had to GUESS who
   you were, and the guess defaulted to "returner", which is exactly
   what bounced them. A page showing both cannot guess wrong.

   ---------------------------------------------------------------------
   🔴 WHAT I CUT OUT OF THE ORIGINAL DESIGN, AND WHY. TELL TY IF HE WANTS
   ANY OF IT BACK — but not as-written, because none of it is true yet.

   1. The "🛡️ Verified, real people" pill. NOBODY IS VERIFIED. That claim
      was stripped from 17 files on Aug 15 and must never return.
   2. "And everyone's still verified as real" inside the anonymity card.
      Same claim, quieter.
   3. THE WHOLE SAGE AI SECTION — "Everybody's building an AI. Ours asks
      first", the memory card, all of it. There is no Sage. It is a
      black full-bleed panel making a privacy promise about a product
      that does not exist. That is the "verified" mistake with a bigger
      typeface.
   4. The "Dating without the talk" card. Not built.
   5. Both waitlist email captures. The doors are open; collecting
      emails to tell people about an app they can join right now is a
      hoop for no reason.

   ⭐ What I KEPT and made true: the six tiles are now six things that
   actually exist today, except Jobs — which is labelled as not built
   and says so in its own copy. That was already the most honest card on
   the page and it stays.
   ===================================================================== */

export default function Landing() {
  const router = useRouter();
  const supabase = browserClient();

  /* ⚠️ TWO FORMS, TWO SETS OF STATE. Sharing one email/password pair
     would mean typing into "Sign in" silently fills "New here" — on a
     page whose entire job is stopping people landing in the wrong box,
     that is the bug in miniature. */
  const [inEmail, setInEmail] = useState('');
  const [inPw, setInPw]       = useState('');
  const [upEmail, setUpEmail] = useState('');
  const [upPw, setUpPw]       = useState('');
  const [reset, setReset]     = useState(false);
  const [busy, setBusy]       = useState('');
  const [err, setErr]         = useState('');
  const [note, setNote]       = useState('');
  /* The address we just sent a confirmation to, if any. */
  const [sent, setSent]       = useState('');

  /* ⭐ ONE FORM AT A TIME. Aug 29.
     ---------------------------------------------------------------------
     Ty, after a second pair of eyes on it: "the landing page to sign in
     and sign up if you're new is too much. It all needs to be on one
     page." It already WAS one page — but the page was 3,808px, 5.3 phone
     screens, and "Sign in" sat at 1,029px. A returning member had to
     scroll past the entire sign-up form to find the box they wanted.

     🔴 That is the Aug 23 bug wearing a fourth hat. Aug 19 sent strangers
     to a bare password page. Aug 23 put the pitch first so they wouldn't
     meet one. The pendulum went too far: now EVERYONE meets the pitch and
     the returner does the digging. A toggle serves both without either
     scrolling, and — unlike the Aug 15 three doors — it never GUESSES
     which one you are. You say.

     ⚠️ 'new' is the default deliberately. A member knows they have an
     account and will tap; a stranger does not know they are allowed in.
     Same tie-break as before: when the two audiences conflict, the one
     who might leave wins. */
  const [mode, setMode]       = useState('new');

  /* ⚠️ OPTIONAL, AND IT HAS TO STAY OPTIONAL. Ty asked for the date here
     as well as on /me, over my objection that it puts a fourth field back
     on a screen we had just got down to three. His call, and he is right
     that asking once at the start catches people who will never open the
     editor — 8 of 18 members have no date because nothing ever asked.

     🔴 Blank is a real answer, not an unfinished form. Nothing validates
     it, nothing marks it required, and somebody who is not counting days
     — or who does not have a date yet — passes straight through. That is
     the whole reason the label says "if you have one". */
  const [upSince, setUpSince] = useState('');

  /* Caps the date picker at today — you cannot have got sober tomorrow.
     ⚠️ Same one-liner Me.jsx uses (line ~339) rather than a shared helper:
     it is one expression, and a `lib/today.js` would be a module whose
     entire job is hiding a Date constructor. */
  const today = new Date().toISOString().slice(0, 10);

  /* ⚠️ ON BY DEFAULT, AND THAT MATCHES WHAT THE CODE ALREADY DID.
     createProfile() has always defaulted privacy_mode to 'anonymous' so
     somebody who taps straight through ends up PROTECTED rather than
     exposed. That was invisible — the safest thing about the sign-up was
     the one thing nobody could see. Now it is a switch you can look at
     and turn off, and the default is unchanged. */
  const [anon, setAnon]       = useState(true);

  /* ⭐ THE HANDLE IS ASKED HERE NOW, ON THE SAME SCREEN AS THE EMAIL.
     Aug 27. Ty walked the real journey as a stranger: "the signing in
     portion is kinda fucking crazy. If I was a user I would probably not
     go through all that." Two screens, five fields, two of them things
     you had to invent — before seeing a single post.

     ⚠️ Filled in on MOUNT, never on the server. makeHandles() uses
     Math.random(); running it during render would produce different
     markup on the server and the client, and React would replace it —
     and worse, two people arriving in the same second would be handed
     the SAME name, so the second one hits a collision on a handle they
     never chose. Same reasoning /welcome already uses. */
  const [upHandle, setUpHandle] = useState('');
  const [mine, setMine]         = useState(false);  // did they type it themselves?
  useEffect(() => { setUpHandle(makeHandles(1)[0]); }, []);

  /* =====================================================================
     🔴 SOMEBODY ARRIVING HERE ON A PASSWORD-RESET LINK GETS SENT TO /reset.
     4 Sept, and a real member was locked out by it.

     D Milton signed up at 03:23, forgot her password four minutes later,
     asked for a reset at 03:32, and clicked the link. `auth.users` shows
     `last_sign_in_at` at 03:33:34 — **the link worked and signed her in.**
     Then it dropped her HERE, on the landing page, which looked at her and
     offered "make an account or sign in" to somebody who was already
     signed in and holding a live recovery session. She wrote: "there's no
     direction on resetting my password."

     ⭐ THE PAGE WASN'T WRONG ABOUT ANYTHING — IT JUST DIDN'T KNOW WHAT IT
     WAS HOLDING. `/reset` has existed and worked the whole time; nothing
     ever handed the session over to it. Thirteenth "everything built
     except the way in" in a month, and the first one that cost somebody
     their account on their first night.

     ⚠️ WHY THIS BELONGS HERE AND NOT ONLY IN SUPABASE'S SETTINGS. The
     root cause is upstream — a recovery link whose redirect isn't on the
     allow list falls back to the Site URL, which is this page. That is a
     dashboard setting, invisible from the code, changeable by anyone with
     the login, and it has now silently broken once. **A page that can
     receive a recovery session should know what to do with one**, whatever
     the dashboard says this week.

     ⚠️ TWO ROUTES IN, because the token arrives in one of two states:
       1. The fragment is still on the URL — forward it, fragment intact.
          🔴 `location.replace`, never router.push: Next's router drops the
          hash, and the hash IS the token. Losing it here would be the
          same class of bug as the server-side redirect that used to eat
          it (that is why middleware exempts /reset at all).
       2. supabase-js already consumed it — then no fragment survives and
          the only signal left is the PASSWORD_RECOVERY event.
     ⚠️ Case 2 is the one that actually bit her: `detectSessionInUrl` is on
     by default, so the client had eaten the token before any of our code
     looked at the URL. */
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash && /type=recovery/.test(hash)) {
      window.location.replace('/reset' + hash);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') window.location.replace('/reset');
    });
    return () => sub?.subscription?.unsubscribe();
  }, [supabase]);

  /* ⚠️ ONE ERROR TRANSLATOR, SHARED. Two copies would drift, and what
     would drift is the rule about never confirming who has an account —
     a safety rule, not a copy preference. */
  function humanise(e) {
    const m = String(e.message || '');
    const code = String(e.code || e.error_code || '');

    /* 🔴 THE BUG THAT SENT PEOPLE TO TY, FOUND Aug 26 IN THE LIVE AUTH LOGS.

       This used to test for the words "rate limit" or "too many". Supabase
       does not say either of those. It says:

         "For security purposes, you can only request this after 55 seconds."

       So a 429 fell straight through to the catch-all and told somebody
       whose account had been created perfectly that the app was broken and
       to go and tell Ty.

       ⭐ THE SHAPE OF IT: sign up → email is slow or lands in spam → press
       the button again → get told it failed. Four people hit this in one
       morning. Five people are stranded at the door against ten members.

       ⚠️ MATCH ON THE CODE FIRST, then the text. `over_email_send_rate_limit`
       and `email_not_confirmed` are stable identifiers; the English is
       marketing copy that Supabase can reword whenever it likes — which is
       exactly how this broke. Text matching stays as a fallback for older
       clients, but it is the belt, not the braces. */

    // ---- you already asked; it's coming ----
    if (code === 'over_email_send_rate_limit'
        || /only request this after/i.test(m)
        || /rate limit|too many/i.test(m)) {
      /* ⭐ NOT AN ERROR MESSAGE. Their account exists and the email is on
         its way — telling them "something went wrong" is simply false. */
      return "You've already asked — it's on its way. Give it a minute and "
           + 'check your email, spam folder included.';
    }

    // ---- signed up, hasn't clicked the link yet ----
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) {
      return 'Almost — click the link in the email we sent you first, then '
           + 'come back and sign in. It hides in spam more often than not.';
    }

    if (m === 'Invalid login credentials') return "That email and password don't match.";

    if (/already registered|already been registered/i.test(m)) {
      return 'There\u2019s already an account on that email. Sign in above, or use '
           + '\u201CI forgot my password\u201D.';
    }

    if (/password/i.test(m) && /short|least|weak/i.test(m)) {
      return 'Passwords need to be at least 8 characters.';
    }

    /* Catch-all. Nobody is shown a database sentence — the Aug 6 block-RPC
       leak quoted an author_id back to a caller with no account, and an
       error message is an output channel.

       ⚠️ It still mentions Ty, and that is fine HERE: by this point we
       genuinely don't know what happened. The failure was that four
       ordinary, expected situations were reaching this line. */
    return 'Something went wrong on our end, not yours. Try once more, and '
         + 'if it keeps happening tell Ty.';
  }

  /* ⭐ CARRY THE ROOM THROUGH THE DOOR — 3 Sept.

     A creator asked Ty for the Kratom 7-OH room, so the entire point of
     `soberbook.app/friends?room=kratom-7oh` is that a STRANGER can follow
     it — a creator's audience is almost entirely people with no account.

     The middleware already preserves the query when it bounces a
     signed-out visitor here (it clones the URL and only changes the
     pathname). Verified live: signed out, that address lands on
     `/login?room=kratom-7oh`, while the control with no param lands on
     plain `/login`. These two handlers were the ONLY place it was lost —
     they pushed a hard-coded destination and the room went with it.

     ⚠️ READ OFF window.location, NOT useSearchParams(). This is the most
     fragile flow in the app and the hook would change how the component
     renders — it needs a Suspense boundary in this Next version and gets
     the whole page wrong if it's missing. Reading the URL at the moment
     we're already navigating adds no render-time behaviour at all.

     ⚠️ Nothing here validates the slug: /friends looks it up and falls
     back to the Front Room for anything it doesn't recognise. A second
     copy of that rule is the copy that drifts.

     🔴 KNOWN GAP, AND IT IS THE EMAIL-CONFIRMATION PATH: if Supabase
     hands back no session, this person leaves for their inbox and returns
     through a link we didn't build. The room is lost there. Not worth
     chasing while confirmation is off — but if it is ever switched back
     on, this is the sentence that stops being true.

     ⚠️ `roomPath` exists because the two callers want different doors when
     a room IS wanted. Signing in goes through '/' so app/page.jsx can
     still decide whether this person has finished first run; a fresh
     sign-up whose profile we just created is already past that question,
     so it goes straight to /friends and skips a hop. When no room is
     wanted, BOTH callers behave exactly as they did before this change. */
  function withRoom(fallback, roomPath = fallback) {
    try {
      const slug = new URLSearchParams(window.location.search).get('room');
      if (slug) return `${roomPath}?room=${encodeURIComponent(slug)}`;
    } catch { /* no URL, no room — the fallback is always right */ }
    return fallback;
  }

  async function signIn(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('in');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: inEmail, password: inPw,
      });
      if (error) throw error;
      router.push(withRoom('/')); router.refresh();
    } catch (e2) { setErr(humanise(e2)); }
    finally { setBusy(''); }
  }

  async function signUp(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('up');
    try {
      const { data, error } = await supabase.auth.signUp({ email: upEmail, password: upPw });
      if (error) throw error;

      /* 🔴 ASK THE RESPONSE WHAT HAPPENED. DO NOT ASSUME THE DASHBOARD SETTING.
         ---------------------------------------------------------------------
         Found Aug 27 in the numbers, not by anyone reporting it. On Aug 26,
         8 people made accounts and 5 never got a profile. Two of them were
         signed in with a live session at the moment this screen told them to
         go and check an email that was never sent — because e-mail
         confirmation had been switched OFF in Supabase. `conf_email_sent`
         was false and `email_confirmed_at` landed 0.0s after `created_at`.

         So they left the app, searched an empty inbox, and gave up, while
         already being one tap from the wall. Nobody files a bug that says
         "I did what the screen told me."

         ⭐ THE FIX IS NOT "delete the check-your-email screen". That screen
         is right whenever confirmation IS on, and the setting is one click
         away from coming back. `signUp()` already TELLS us which world we
         are in: if confirmation is off, Supabase hands back a session; if it
         is on, `data.session` is null and the mail is genuinely on its way.
         Reading that is the difference between a page that works either way
         and a page that is correct until somebody touches a dashboard.

         ⚠️ We push to '/' rather than straight to '/welcome' — the SAME
         place signIn() goes. app/page.jsx already decides where a signed-in
         person belongs (wall if they have a profile, welcome if not).
         Sending them directly to /welcome would be a second copy of that
         rule, and the second copy is the one that drifts. That is the
         0046 → 0049 lesson, applied before it can bite. */
      if (data?.session) {
        /* ⭐ ONE SCREEN. The handle was already in the box, so the row can
           be created right now and this person goes straight to the wall
           — no second page, nothing invented.

           ⚠️ IT FAILS SOFT, ON PURPOSE. If the insert doesn't take, we do
           NOT show an error and strand somebody who has a working
           account: we push to '/', which routes a profile-less member to
           /welcome, the page that has always done this job. The worst
           case is the old two-screen journey — which is exactly what we
           had this morning. 🔴 A hard failure here would be worse than
           the problem being fixed. */
        /* ⚠️ `anon` comes from the switch on the form, and its default is
           true — the same value this call was hard-coded to before. The
           behaviour has not changed; it is just visible and choosable now. */
        /* ⚠️ `since` was already a parameter of createProfile — it has
           been there since /welcome was the only caller, and the one-page
           sign-up simply never passed it. Nothing new in first-run.js. */
        const r = await createProfile(supabase, {
          handle: upHandle, privacy: anon ? 'anonymous' : 'open',
          since: upSince, generated: !mine,
        });
        /* ⚠️ The room is honoured ONLY on the r.ok branch. If the profile
           insert didn't take, this person has no profile yet — they go to
           '/', which routes them to /welcome to finish first run. Dropping
           somebody into a room without a profile would be using a creator's
           link to skip the step that 30 Aug proved people get stuck on. */
        router.push(r.ok ? withRoom('/wall', '/friends') : withRoom('/'));
        router.refresh();
        return;
      }

      /* ⚠️ `sent` is separate from `note` because it changes the SHAPE of
         the form, not just the text above it. Somebody who has just signed
         up should not be looking at a Sign up button any more — that button
         is what they press again, and pressing it again is what produced
         the 429 that told them the app was broken. */
      setSent(upEmail);
      setNote('Check your email to confirm, then come back and sign in above. '
            + 'Look in spam too — it hides there more often than not.');
    } catch (e2) { setErr(humanise(e2)); }
    finally { setBusy(''); }
  }

  async function sendReset(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('reset');
    try {
      /* 🔴 THIS MUST NEVER CONFIRM WHO IS A MEMBER. Supabase succeeds
         whether or not the address exists, and the message below says
         the same thing either way ON PURPOSE. Otherwise anybody who
         suspects their brother, their boss or their ex has an account
         here could confirm it by typing their address in. "If that
         address has an account" is doing real work in that sentence. */
      const { error } = await supabase.auth.resetPasswordForEmail(inEmail, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) throw error;
      setNote('If that address has an account, a reset link is on its way. '
            + 'Check your spam folder too.');
    } catch (e2) { setErr(humanise(e2)); }
    finally { setBusy(''); }
  }

  return (
    <div className="lp">

      <div className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-leaf">🌿</div>
          <div className="lp-brand">SOBER BOOK</div>
          <h1 className="lp-h1">You never have to explain yourself here.</h1>
          <p className="lp-lede">
            A home for people in recovery. Everybody here already gets it —
            because they’ve been there too.
          </p>

          {/* ⚠️ The third pill WAS "🛡️ Verified, real people". It is gone and
              must stay gone — nobody is verified. This one says something
              the product can actually keep. */}
          <div className="lp-pills">
            <span className="lp-pill lp-p1">💊 All paths welcome — Suboxone included</span>
            <span className="lp-pill lp-p2">🤫 Stay anonymous</span>
            <span className="lp-pill lp-p3">🌱 Free, and the doors are open</span>
          </div>

          {/* ⚠️ Hidden while the "check your email" panel is up. That panel
              only appears when confirmation is ON and there is genuinely
              mail on the way; offering a Sign in tab at that moment invites
              somebody to try signing in to an account they have not
              confirmed yet, and fail. */}
          {!sent && (
            <div className="lp-seg" role="tablist" aria-label="Sign up or sign in">
              <button type="button" role="tab" id="tab-new"
                      aria-selected={mode === 'new'} aria-controls="pane-new"
                      onClick={() => { setMode('new'); setErr(''); setNote(''); }}>
                I&rsquo;m new
              </button>
              <button type="button" role="tab" id="tab-in"
                      aria-selected={mode === 'in'} aria-controls="pane-in"
                      onClick={() => { setMode('in'); setErr(''); setNote(''); }}>
                Sign in
              </button>
            </div>
          )}

          <div className="lp-doors" id="join">

            {/* ---------- NEW HERE, FIRST ----------
                Email, password, and a handle that is already filled in.
                That is the whole account. ⭐ /welcome is no longer on the
                path — it stays for the case where e-mail confirmation is
                switched back on and there is no session to create a
                profile with. See lib/first-run.js. ---------- */}
            {/* ⚠️ The "check your email" panel lives inside this card, so
                the card must stay mounted when `sent` is set even if the
                tab has moved. Hence `|| sent` — without it, confirming by
                email would blank the screen the moment mode changed. */}
            <div className="lp-card lp-new"
                 id="pane-new" role="tabpanel" aria-labelledby="tab-new"
                 hidden={mode !== 'new' && !sent}>

              {/* 🔴 AFTER SIGNING UP, THE SIGN-UP BUTTON GOES AWAY.

                  Found Aug 26 in the live auth logs. The old page left the
                  form exactly as it was and put a note underneath. So the
                  sequence was: create account → email is slow or in spam →
                  press the same button again → 429 → "something went wrong,
                  tell Ty". Four people in one morning, on an account that
                  had been created perfectly.

                  ⭐ The fix isn't better error copy, it's removing the thing
                  they press. You cannot get the rate-limit error from a
                  button that isn't there.

                  ⚠️ "Send it again" is still offered, because the email
                  genuinely does go missing — but it's a quiet link rather
                  than the big green button, and if they hit the limit the
                  message now tells them the truth. */}
              {sent ? (
                <>
                  <h2>Check your email</h2>
                  <p className="lp-said">
                    We sent a confirmation link to <strong>{sent}</strong>.
                    Click it, then come back and sign in above.
                  </p>
                  <p className="lp-said">
                    <strong>Look in your spam folder.</strong> It lands there
                    more often than not — and it&rsquo;s from Sober Book.
                  </p>
                  <button className="lp-go" type="button" disabled={!!busy}
                          onClick={() => { setSent(''); setNote(''); setErr(''); }}>
                    Use a different email
                  </button>
                  <p className="lp-fineprint">
                    Didn&rsquo;t arrive after a few minutes?{' '}
                    <button type="button" className="lp-link"
                            disabled={!!busy}
                            onClick={(ev) => { setUpEmail(sent); signUp(ev); }}>
                      Send it again
                    </button>
                  </p>
                </>
              ) : (
              <>
              <h2>New here?</h2>
              <p className="lp-said">
                Make an account and you’re in. Takes a minute, and you can be
                anonymous from the first second.
              </p>

              <form onSubmit={signUp}>
                <label className="lp-lab" htmlFor="up-em">Email</label>
                <input id="up-em" type="email" required autoComplete="email"
                       value={upEmail} onChange={(e) => setUpEmail(e.target.value)}
                       placeholder="you@email.com" />

                <label className="lp-lab" htmlFor="up-pw">Password</label>
                <input id="up-pw" type="password" required minLength={8}
                       autoComplete="new-password"
                       value={upPw} onChange={(e) => setUpPw(e.target.value)}
                       placeholder="at least 8 characters" />

                {/* ⭐ THE THIRD FIELD, AND IT IS NEVER BLANK.
                    The handle used to live on a whole second screen and
                    was the only required box there — a stranger being
                    asked to invent the name people in recovery will know
                    them by, before they had seen anything. It arrives
                    already filled. Changing it is optional; ignoring it
                    is fine. ⚠️ Nothing here says "sober", "clean" or
                    "day one" — a handle travels, and a generated name
                    must never be the thing that outs somebody. */}
                <label className="lp-lab" htmlFor="up-h">
                  Your handle <span className="lp-opt">— change it or keep it</span>
                </label>
                <div className="lp-handle">
                  <input id="up-h" type="text" required minLength={3} maxLength={20}
                         autoComplete="off" autoCapitalize="none" spellCheck={false}
                         value={upHandle}
                         /* 🔴 CLEANED ON EVERY KEYSTROKE. The box used to
                            take anything, and the database then refused
                            it — eleven people ended up with a login and
                            no account, four of them inside a tenth of a
                            second. Typing your own name is what breaks
                            it: "Mary Jane", "mary.jane", "O'Brien".
                            A space becomes an underscore so two words
                            stay two words; other punctuation is dropped. */
                         onChange={(e) => { setUpHandle(cleanHandle(e.target.value)); setMine(true); }} />
                  <button type="button" className="lp-link" disabled={!!busy}
                          onClick={() => { setUpHandle(makeHandles(1)[0]); setMine(false); }}>
                    Another
                  </button>
                </div>
                {/* 🔴 THE THREE-CHARACTER FLOOR, GUARDED IN THE APP — 3 Sept.
                    `minLength={3}` above was the ONLY thing standing between a
                    short handle and a database that refuses it. Measured on the
                    live page: with the value at "ab", `validity.tooShort` came
                    back FALSE. Whether that holds for a real keystroke I could
                    not prove either way — and that is exactly the point. This
                    rule is enforced by a CHECK constraint in Postgres, and
                    leaning on a browser attribute to keep people away from it
                    is the same shape as the bug that left eleven people with a
                    login and no account.

                    ⭐ And cleanHandle can MAKE a short one out of a long one:
                    "J.D." loses both dots and comes out "JD", "A.J." → "AJ".
                    Nobody typed two characters; the cleaner produced them.

                    ⚠️ The sentence swaps rather than stacking, because a
                    disabled button with no reason next to it is the dead-end
                    this file already fixed once (16 Aug). */}
                <p className="lp-fineprint">
                  {upHandle.length < 3
                    ? 'A handle needs three characters or more — add one or two and you’re in.'
                    : 'This is the only name other members see. Not your email, not your real name — and you can change it later.'}
                </p>

                <button className="lp-go" type="submit"
                        disabled={!!busy || upHandle.length < 3}>
                  {busy === 'up' ? 'One second…' : 'Create my account'}
                </button>
              </form>

              {/* ⚠️ LAST, AND OPTIONAL. It sits below the handle so the
                  three fields that make an account come first — somebody
                  who taps straight through has still finished. The label
                  carries the permission, not a hint underneath it: "if you
                  have one" is doing the work of a whole sentence. */}
              <label className="lp-lab" htmlFor="up-m">
                Sober since <span className="lp-opt">— if you have one</span>
              </label>
              {/* Same three dropdowns as /me. One control, three callers. */}
              <DatePick value={upSince} disabled={!!busy}
                        idPrefix="up" onChange={setUpSince} />

              {/* ⭐ THE SAFEST THING ABOUT SIGNING UP, MADE VISIBLE.
                  The default was already anonymous; until now nothing on
                  the screen said so. ⚠️ The two sentences describe what
                  actually happens in the app — anonymity is per-post and
                  reversible either way, so neither wording promises
                  something the product doesn't do. */}
              <div className="lp-anon">
                <button type="button" className="lp-sw" id="anon"
                        role="switch" aria-checked={anon}
                        aria-label="Stay anonymous"
                        onClick={() => setAnon((v) => !v)} />
                <div>
                  <div className="lp-anon-t">Stay anonymous</div>
                  <div className="lp-anon-s">
                    {anon
                      ? 'Only your handle shows. No real name, no face.'
                      : 'Your display name can show on posts. You can still go anonymous on any single post.'}
                  </div>
                </div>
              </div>

              <p className="lp-fineprint">
                Your email is never shown to another member. Ever. Not a
                treatment centre, and nobody sells your information.
              </p>
              </>
              )}
            </div>

            {/* ---------- SIGN IN, SECOND NOW ----------
                🔴 THIS BOX USED TO BE ON TOP, AND THAT WAS THE BUG WEARING
                A THIRD HAT. Aug 19 sent strangers to a bare password page.
                Aug 23 put the pitch and both boxes on ONE page — but left
                sign-in first, so the very first thing a new person read
                was still a password prompt for an account they did not
                have. Ty found the last of it himself on Aug 27 by walking
                the journey as a stranger.

                ⚠️ Returning members KNOW they have an account and will
                scroll; a stranger does not know they are allowed in. When
                the two audiences conflict, the one who might leave wins.
                ---------- */}
            <div className="lp-card"
                 id="pane-in" role="tabpanel" aria-labelledby="tab-in"
                 hidden={mode !== 'in' || !!sent}>
              <h2>{reset ? 'Let’s get you back in' : 'Sign in'}</h2>
              <p className="lp-said">
                {reset
                  ? 'Put in your email and we’ll send a link to set a new password.'
                  : 'Been here before? Pick up wherever you left it.'}
              </p>

              <form onSubmit={reset ? sendReset : signIn}>
                <label className="lp-lab" htmlFor="in-em">Email</label>
                <input id="in-em" type="email" required autoComplete="email"
                       value={inEmail} onChange={(e) => setInEmail(e.target.value)}
                       placeholder="you@email.com" />

                {!reset && (
                  <>
                    <label className="lp-lab" htmlFor="in-pw">Password</label>
                    <input id="in-pw" type="password" required autoComplete="current-password"
                           value={inPw} onChange={(e) => setInPw(e.target.value)} />
                  </>
                )}

                <button className="lp-go" type="submit" disabled={!!busy}>
                  {busy === 'in' || busy === 'reset' ? 'One second…'
                    : reset ? 'Send me a link' : 'Sign in'}
                </button>
              </form>

              <button className="lp-linkbtn" type="button"
                      onClick={() => { setReset(!reset); setErr(''); setNote(''); setInPw(''); }}>
                {reset ? 'Back to signing in' : 'I forgot my password'}
              </button>
            </div>

            {err && <div className="lp-err" role="alert">{err}</div>}
            {note && <div className="lp-ok" role="status">{note}</div>}
          </div>
        </div>
      </div>

      {/* ---------- what's actually in here ---------- */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2">Everything you need, under one roof</h2>
          <p className="lp-sect">
            Recovery isn’t just about not drinking. It’s about building a life.
            Sober Book helps with all of it.
          </p>

          <div className="lp-grid">
            <div className="lp-tile lp-c1">
              <span className="lp-tag">NOBODY ELSE HAS THIS</span>
              <div className="lp-ic">🤫</div>
              <h3>Anonymous if you want</h3>
              {/* ⚠️ The original ended "And everyone's still verified as real."
                  Cut. Nobody is verified. */}
              <p>Use a handle and an icon — no real name, no face. You can go
                 anonymous on a single post and back again, and nobody can tell
                 it was the same person.</p>
            </div>

            <div className="lp-tile lp-c2">
              <span className="lp-tag">NOT BUILT YET</span>
              <div className="lp-ic">💼</div>
              <h3>Jobs</h3>
              <p>Work you can apply to under your handle, so what you disclose
                 is your call. We’re building a roster of employers who actively
                 want to hire people in recovery — that part isn’t there yet,
                 and we’ll say so plainly until it is.</p>
            </div>

            <div className="lp-tile lp-c3">
              <div className="lp-ic">👋</div>
              <h3>Friends who get it</h3>
              <p>Find people, add them, talk. Your friends list puts whoever
                 you haven’t heard from at the top — so you notice the quiet
                 one before it’s too long.</p>
            </div>

            <div className="lp-tile lp-c4">
              <div className="lp-ic">🪑</div>
              <h3>Meetings, day or night</h3>
              <p>Real NA meetings straight from their own listings, one tap to
                 join — plus rooms members open here themselves when they can’t
                 sleep.</p>
            </div>

            <div className="lp-tile lp-c5">
              <div className="lp-ic">🕯️</div>
              <h3>Somewhere quiet</h3>
              <p>Write what gets you through — your daughter, Jesus, the ocean,
                 nothing at all — on the one wall in here nobody can argue with
                 you on. Plus something to do with your hands at 3am.</p>
            </div>

            <div className="lp-tile lp-c6">
              <div className="lp-ic">🎵</div>
              <h3>Your days and your song</h3>
              <p>Count your days, keep a lifetime total that never resets even
                 if you start over, and put the song that got you through right
                 on your profile.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-quote">
        <div className="lp-wrap">
          <blockquote>
            “Every time I met someone new I’d think — do I tell them? On here I
            don’t have to. Everybody already knows.”
            <cite>— why we built this</cite>
          </blockquote>
        </div>
      </section>

      <section className="lp-sec lp-cta">
        <div className="lp-wrap">
          <h2 className="lp-h2">Come home.</h2>
          <p>No judgment. No hiding. Just people who get it.</p>
          {/* ⚠️ An anchor back to the form, NOT a second email capture. The
              doors are open; collecting an address to tell somebody about an
              app they can join right now is a hoop for no reason. */}
          <a href="#join">Make an account</a>
        </div>
      </section>

      <p className="lp-foot">
        Sober Book · a safe place to be yourself · all paths welcome
        {' · '}<a href="/privacy">privacy</a>
      </p>
    </div>
  );
}
