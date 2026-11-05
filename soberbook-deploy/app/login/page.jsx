'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import { makeHandles, createProfile, cleanHandle } from '../../lib/first-run';
import { isIosApp } from '../../lib/is-ios-app';
import DatePick from '../components/DatePick';
import { PROGRAM_FROM_URL } from '../../lib/program';

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

/* =====================================================================
   ⭐ 3 Nov 2026 — THE FACELIFT. Ty: "give this a nice little facelift and
   make it look sexy, but easy to operate as well." Prototype approved the
   same night ("I like it").

   🔴 ONLY THE LOOK AND THE WORDS CHANGED. Every handler above the return —
   signUp, signIn, sendReset, humanise, withRoom, the recovery-link
   forwarding, the handle cleaner, the optional date, the anonymous switch,
   the "check your email" panel, the iPhone coffee rule — is untouched.
   The form is still the first thing under the headline and "I'm new" is
   still the default (29 Aug).

   ⚠️ WHAT THE COPY DROPPED, ON PURPOSE:
   - "Free forever" / "stays free" — Ty, 3 Nov: don't promise forever.
   - "No ads" — sponsors exist now.
   - The Jobs tile — it isn't built; the page now only shows what is.
   - "a lifetime total that never resets even if you start over" — we don't
     put a reset on the front door.
   ⚠️ The phone and the three notifications in the hero are DECORATION,
   labelled "Example screens", aria-hidden, and carry no real member.
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

  /* ⭐ 5 Nov 2026 — Kenny found it hard to get his password in. A member
     who has signed in on this phone before lands on Sign in, not "I'm
     new" (where the password box says "At least 8 characters" and makes
     an account instead). The flag is set here on any sign-in or sign-up,
     and by the wall for anybody already signed in. ⚠️ It never guesses
     for a stranger: no flag, the default above still wins. */
  const [back, setBack]       = useState(false);
  useEffect(() => {
    try { if (window.localStorage.getItem('sb_seen') === '1') { setMode('in'); setBack(true); } } catch (e) { /* storage blocked */ }
  }, []);
  const [showIn, setShowIn]   = useState(false);   // password visible?
  const [showUp, setShowUp]   = useState(false);

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

  /* Apple 3.1.1 — see the comment above the coffee section. Starts true so the
     server renders WITHOUT the donation block and the browser reveals it only
     once it has confirmed this is not the iPhone app. */
  const [iosApp, setIosApp] = useState(true);
  useEffect(() => { setIosApp(isIosApp()); }, []);

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
      try { window.localStorage.setItem('sb_seen', '1'); } catch (e3) { /* fine */ }
      router.push(withRoom('/')); router.refresh();
    } catch (e2) { setErr(humanise(e2)); }
    finally { setBusy(''); }
  }

  async function signUp(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('up');
    try {
      /* ⭐ 29 Oct 2026 — CRCC's campaign link is /login?program=illinois.
         The program rides along as account metadata; migration 0192 copies
         it into program_members when the profile is created. Read off
         window.location for the same reason withRoom() is. Anything that
         isn't a known program is ignored. */
      let program = null;
      try {
        const p = new URLSearchParams(window.location.search).get('program');
        if (p && PROGRAM_FROM_URL.includes(p)) program = p;
      } catch { /* no URL, no program */ }
      const { data, error } = await supabase.auth.signUp(
        program ? { email: upEmail, password: upPw, options: { data: { program } } }
                : { email: upEmail, password: upPw });
      if (error) throw error;
      try { window.localStorage.setItem('sb_seen', '1'); } catch (e3) { /* fine */ }

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

  /* ---------- the facelift's moving parts (decoration only) ---------- */

  /* The example clock in the hero and the features tile. ⚠️ Starts from fixed
     numbers so the server and the browser render the same markup; it only
     starts ticking after mount. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const base = ((412 * 24 + 9) * 3600) + 41 * 60 + 11 + tick;
  const two = (n) => String(n).padStart(2, '0');
  const clk = { d: Math.floor(base / 86400), h: two(Math.floor(base % 86400 / 3600)),
                m: two(Math.floor(base % 3600 / 60)), s: two(base % 60) };
  const mtg = Math.max(0, 480 - tick);

  /* Stars and embers behind the headline. Skipped entirely for anybody who
     has asked their phone for less motion. */
  const sky = useRef(null);
  useEffect(() => {
    const c = sky.current; if (!c) return;
    const x = c.getContext('2d'); if (!x) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, pts = [], raf = 0;
    const size = () => {
      W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = Array.from({ length: 80 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + .3, t: Math.random() * 6, v: Math.random() * .25 + .05, e: i < 20 }));
    };
    const draw = () => {
      x.clearRect(0, 0, W, H);
      for (const q of pts) {
        q.t += .02;
        if (q.e) { q.y -= q.v * 2; if (q.y < 0) { q.y = H; q.x = Math.random() * W; }
          x.fillStyle = `rgba(255,190,110,${.35 + .35 * Math.sin(q.t)})`; }
        else x.fillStyle = `rgba(255,255,255,${(.25 + .5 * Math.abs(Math.sin(q.t))) * (1 - q.y / H)})`;
        x.beginPath(); x.arc(q.x, q.y, q.e ? q.r + .6 : q.r, 0, 7); x.fill();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    size(); draw();
    window.addEventListener('resize', size);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, []);

  /* 5 Nov 2026: the bar now also shows while the form is still BELOW the
     screen. On an iPhone the card starts ~900px down, so a returning member
     opened the page and saw no way in at all until they scrolled. It still
     hides whenever any part of the form is on screen, so it never sits on
     top of the boxes you are typing in. */
  /* ⭐ THE BAR THAT FOLLOWS YOU. Once the form has scrolled off the top, a
     slim bar with "Make my account" and "Sign in" sits at the bottom of the
     screen, so nobody reading the features has to scroll back to find a
     door. Hidden while the "check your email" panel is up. */
  const door = useRef(null);
  const [dock, setDock] = useState(false);
  useEffect(() => {
    const el = door.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setDock(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  function goTo(which) {
    setMode(which); setErr(''); setNote('');
    door.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* The little line under the date. Blank stays blank — "if you have one". */
  let sinceLine = '';
  if (upSince) {
    const n = Math.floor((Date.now() - new Date(upSince + 'T00:00:00')) / 864e5);
    sinceLine = n < 1 ? 'Day one counts. Welcome in. 🌱'
      : `That’s ${n.toLocaleString()} day${n === 1 ? '' : 's'}. Proud of you. 🪙`;
  }

  const TICK_A = ['18+ only', 'Live sober clock', 'Recovery coins', 'Talk Rooms', 'Meetings any hour', 'Anonymous if you want', 'All paths welcome'];
  const TICK_B = ['RecoveryMap by Dr. Labor', 'A plan for 3 a.m.', 'Daily pledge', 'Readings', 'Rooms for every path', 'Chat', 'Somewhere quiet'];
  const strip = (arr) => [...arr, ...arr].map((w, i) => (
    <span key={i}><span>{w}</span><span className="lx-star">✦</span></span>));

  return (
    <div className="lx">

      {/* ⭐ 29 Oct 2026 — CRISIS LINE ON THE FRONT DOOR. CRCC (Illinois) asked
          for 988 and the Illinois Helpline to be visible on the public landing
          page; they had looked and found nothing. Shown to everybody: the app
          never asks where you are, so it cannot pick a state for you.
          Neither line is run by Sober Book and nobody pays to be here. */}
      <div className="lx-crisis" role="note">
        Need someone right now? Call or text <a href="tel:988">988</a>, any hour.
        <span className="lx-crisis-s">
          In Illinois: <a href="tel:18332346343">833-234-6343</a> or text HELP to 833234
        </span>
      </div>

      <header className="lx-hero">
        <div className="lx-sky" aria-hidden="true" />
        <div className="lx-sun" aria-hidden="true" />
        <canvas className="lx-stars" ref={sky} aria-hidden="true" />

        <div className="lx-wrap">
          <div className="lx-brand">
            <div className="lx-logo"><img src="/icon-192.png" alt="" width="40" height="40" />SOBER BOOK</div>
            {!sent && <button type="button" className="lx-pill" onClick={() => goTo('in')}>Sign in</button>}
          </div>

          <div className="lx-live"><i aria-hidden="true" /> Open any hour, day or night.</div>

          <h1 className="lx-h1">
            <span className="lx-ln"><span>You never</span></span>
            <span className="lx-ln"><span>have to</span></span>
            <span className="lx-ln"><span className="lx-hl">explain
              <svg className="lx-scrib" viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 14 C 60 4, 120 20, 180 10 S 270 6, 296 12" />
              </svg></span></span>
            <span className="lx-ln"><span>yourself here.</span></span>
          </h1>
          <p className="lx-lede">
            A home for people in recovery. Everybody here already gets it,
            because they’ve been there too.
          </p>

          {/* DECORATION — an example phone and three example notifications.
              aria-hidden, labelled, and none of it is a real member. */}
          <div className="lx-stage" aria-hidden="true">
            <div className="lx-phone"><div className="lx-scr">
              <div className="lx-bar">SOBER BOOK<span>The wall</span></div>
              <div className="lx-clock"><small>SOBER RIGHT NOW</small>
                <div className="lx-day">Day {clk.d}</div>
                <div className="lx-hms"><div>{clk.h}<em>HRS</em></div><div>{clk.m}<em>MIN</em></div><div>{clk.s}<em>SEC</em></div></div>
              </div>
              <div className="lx-mini"><b>🌱 morningbird</b><br />90 days today. Didn’t think I’d see it.<div className="lx-cn">🪙 14 coins</div></div>
              <div className="lx-mini"><b>🕊️ quietmorning</b><br />Rough night but I made it to a meeting.<div className="lx-cn">🪙 6 coins</div></div>
            </div></div>
            <div className="lx-note lx-n1"><div className="lx-em" style={{ background: '#FFF1C9' }}>🪙</div><div><b>steadyhands sent a coin</b><span>“Proud of you.”</span></div></div>
            <div className="lx-note lx-n2"><div className="lx-em" style={{ background: '#E7DBFF' }}>🎙️</div><div><b>A Talk Room just opened</b><span>Can’t sleep? 4 listening</span></div></div>
            <div className="lx-note lx-n3"><div className="lx-em" style={{ background: '#E3F4E9' }}>🪑</div><div><b>NA meeting in 8 min</b><span>Tap to dial in</span></div></div>
            <div className="lx-sample">Example screens</div>
          </div>

          <div className="lx-card" id="join" ref={door}>
            {/* ⚠️ Hidden while the "check your email" panel is up. That panel
                only appears when confirmation is ON and there is genuinely
                mail on the way; offering a Sign in tab at that moment invites
                somebody to try signing in to an account they have not
                confirmed yet, and fail. */}
            {!sent && (
              <div className="lx-seg" role="tablist" aria-label="Sign up or sign in" data-on={mode}>
                <div className="lx-slider" aria-hidden="true" />
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

            {/* ---------- NEW HERE, FIRST ----------
                Email, password, and a handle that is already filled in.
                That is the whole account. See the Aug 26–29 notes above. */}
            <div className="lx-pane"
                 id="pane-new" role="tabpanel" aria-labelledby="tab-new"
                 hidden={mode !== 'new' && !sent}>

              {/* 🔴 AFTER SIGNING UP, THE SIGN-UP BUTTON GOES AWAY (Aug 26).
                  You cannot get the rate-limit error from a button that
                  isn't there. "Send it again" stays as a quiet link. */}
              {sent ? (
                <>
                  <h2>Check your email</h2>
                  <p className="lx-said">
                    We sent a confirmation link to <strong>{sent}</strong>.
                    Click it, then come back and sign in.
                  </p>
                  <p className="lx-said">
                    <strong>Look in your spam folder.</strong> It lands there
                    more often than not — and it&rsquo;s from Sober Book.
                  </p>
                  <button className="lx-go" type="button" disabled={!!busy}
                          onClick={() => { setSent(''); setNote(''); setErr(''); }}>
                    Use a different email
                  </button>
                  <p className="lx-fine">
                    Didn&rsquo;t arrive after a few minutes?{' '}
                    <button type="button" className="lx-link"
                            disabled={!!busy}
                            onClick={(ev) => { setUpEmail(sent); signUp(ev); }}>
                      Send it again
                    </button>
                  </p>
                </>
              ) : (
              <>
              <h2>Come on in.</h2>
              <p className="lx-said">
                It takes a minute, and you can be anonymous from the first second.
              </p>

              <form onSubmit={signUp}>
                <label className="lx-lab" htmlFor="up-em">Email</label>
                <input id="up-em" className="lx-inp" type="email" required autoComplete="email"
                       value={upEmail} onChange={(e) => setUpEmail(e.target.value)}
                       placeholder="you@email.com" />

                <label className="lx-lab" htmlFor="up-pw">Password</label>
                <div className="lx-pw">
                  <input id="up-pw" className="lx-inp" type={showUp ? 'text' : 'password'} required minLength={8}
                         autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                         value={upPw} onChange={(e) => setUpPw(e.target.value)}
                         placeholder="At least 8 characters" />
                  <button type="button" className="lx-eye" aria-controls="up-pw" aria-pressed={showUp}
                          onClick={() => setShowUp(!showUp)}>{showUp ? 'Hide' : 'Show'}</button>
                </div>

                {/* ⭐ THE THIRD FIELD, AND IT IS NEVER BLANK. ⚠️ Nothing a
                    generated handle says may out somebody — see first-run.js. */}
                <label className="lx-lab" htmlFor="up-h">
                  Your handle <span className="lx-opt">· the only name anyone sees</span>
                </label>
                <div className="lx-row">
                  <input id="up-h" className="lx-inp" type="text" required minLength={3} maxLength={20}
                         autoComplete="off" autoCapitalize="none" spellCheck={false}
                         value={upHandle}
                         /* 🔴 CLEANED ON EVERY KEYSTROKE (eleven people with a
                            login and no account). Do not remove. */
                         onChange={(e) => { setUpHandle(cleanHandle(e.target.value)); setMine(true); }} />
                  <button type="button" className="lx-ghost" disabled={!!busy}
                          onClick={() => { setUpHandle(makeHandles(1)[0]); setMine(false); }}>
                    <span className="lx-dice" aria-hidden="true">🎲</span> Another
                  </button>
                </div>
                {/* 🔴 THE THREE-CHARACTER FLOOR, GUARDED IN THE APP — 3 Sept. */}
                <p className="lx-fine lx-left">
                  {upHandle.length < 3
                    ? 'A handle needs three characters or more — add one or two and you’re in.'
                    : 'Not your email, not your real name — and you can change it later.'}
                </p>

                <button className="lx-go" type="submit"
                        disabled={!!busy || upHandle.length < 3}>
                  {busy === 'up' ? 'One second…' : <>Create my account <span className="lx-arr">→</span></>}
                </button>
              </form>

              {/* ⚠️ LAST, AND OPTIONAL. Blank is a real answer. */}
              <label className="lx-lab" htmlFor="up-m">
                Sober since <span className="lx-opt">· if you have one</span>
              </label>
              <DatePick value={upSince} disabled={!!busy}
                        idPrefix="up" onChange={setUpSince} />
              {sinceLine && <p className="lx-count">{sinceLine}</p>}

              {/* ⭐ THE SAFEST THING ABOUT SIGNING UP, MADE VISIBLE. */}
              <div className="lx-anon">
                <button type="button" className="lx-sw" id="anon"
                        role="switch" aria-checked={anon}
                        aria-label="Stay anonymous"
                        onClick={() => setAnon((v) => !v)} />
                <div>
                  <div className="lx-anon-t">Stay anonymous</div>
                  <div className="lx-anon-s">
                    {anon
                      ? 'Only your handle shows. No real name, no face.'
                      : 'Your display name can show on posts. You can still go anonymous on any single post.'}
                  </div>
                </div>
              </div>

              <p className="lx-fine">
                Your email is never shown to another member. Ever. Not a
                treatment centre, and nobody sells your information.
              </p>
              </>
              )}
            </div>

            {/* ---------- SIGN IN ---------- */}
            <div className="lx-pane"
                 id="pane-in" role="tabpanel" aria-labelledby="tab-in"
                 hidden={mode !== 'in' || !!sent}>
              {back && !reset && (
                <p className="lx-back">👋 This phone has signed in before, so we opened Sign in for you.</p>
              )}
              <h2>{reset ? 'Let’s get you back in' : 'Welcome back.'}</h2>
              <p className="lx-said">
                {reset
                  ? 'Put in your email and we’ll send a link to set a new password.'
                  : 'Good to see you. Pick up wherever you left it.'}
              </p>

              <form onSubmit={reset ? sendReset : signIn}>
                <label className="lx-lab" htmlFor="in-em">Email</label>
                <input id="in-em" className="lx-inp" type="email" required autoComplete="email"
                       value={inEmail} onChange={(e) => setInEmail(e.target.value)}
                       placeholder="you@email.com" />

                {!reset && (
                  <>
                    <label className="lx-lab" htmlFor="in-pw">Password</label>
                    <div className="lx-pw">
                      <input id="in-pw" className="lx-inp" type={showIn ? 'text' : 'password'} required autoComplete="current-password"
                             autoCapitalize="none" autoCorrect="off" spellCheck={false}
                             value={inPw} onChange={(e) => setInPw(e.target.value)}
                             placeholder="Your password" />
                      <button type="button" className="lx-eye" aria-controls="in-pw" aria-pressed={showIn}
                              onClick={() => setShowIn(!showIn)}>{showIn ? 'Hide' : 'Show'}</button>
                    </div>
                  </>
                )}

                <button className="lx-go" type="submit" disabled={!!busy}>
                  {busy === 'in' || busy === 'reset' ? 'One second…'
                    : reset ? 'Send me a link' : <>Sign in <span className="lx-arr">→</span></>}
                </button>
              </form>

              <button className="lx-linkbtn" type="button"
                      onClick={() => { setReset(!reset); setErr(''); setNote(''); setInPw(''); }}>
                {reset ? 'Back to signing in' : 'I forgot my password'}
              </button>
            </div>

            {err && <div className="lx-err" role="alert">{err}</div>}
            {note && <div className="lx-ok" role="status">{note}</div>}
          </div>

          {/* WHO BUILT THIS — 11 Sept. 🔴 EVERY NAME HERE CAME FROM TY, TYPED
              OUT. If a name ever needs changing, ask; do not reconstruct it. */}
          <p className="lx-who">Built by people in recovery, in Ohio.</p>
          <p className="lx-who">
            <b>Ty Howell</b>, founder and CEO{' · '}<b>Nic Rossiter</b>, cofounder{' · '}<b>Kenneth Kerns</b>, cofounder
          </p>
          <p className="lx-who lx-mail"><a href="mailto:hello@soberbook.app">hello@soberbook.app</a></p>
        </div>
      </header>

      <div className="lx-tick" aria-hidden="true"><div>{strip(TICK_A)}</div></div>
      <div className="lx-tick lx-tick-b" aria-hidden="true"><div>{strip(TICK_B)}</div></div>

      {/* ---------- what's actually in here ----------
          🔴 ONLY THINGS THAT EXIST TODAY. If a tile's feature is ever pulled,
          the tile goes with it. */}
      <section className="lx-sec">
        <div className="lx-wrap">
          <div className="lx-kick">Everything under one roof</div>
          <h2 className="lx-h2">All of it.<br />One app.</h2>
          <p className="lx-intro">
            Recovery isn’t only about not drinking or using. It’s about building
            a life, and Sober Book helps with all of it.
          </p>

          <div className="lx-grid">
            <div className="lx-tile lx-green lx-wide">
              <div className="lx-ic">⏱️</div><h3>Your live sober clock</h3>
              <p>Ticking right on your page, down to the second. Day one counts too.</p>
              <div className="lx-big" aria-hidden="true">
                <div><b>{clk.d}</b><em>DAYS</em></div><div><span>{clk.h}</span><em>HRS</em></div>
                <div><span>{clk.m}</span><em>MIN</em></div><div><span>{clk.s}</span><em>SEC</em></div>
              </div>
            </div>
            <div className="lx-tile lx-navy"><div className="lx-ic"><div className="lx-coin" /></div><h3>Recovery coins</h3><p>Send a coin instead of a like. Every day counts.</p></div>
            <div className="lx-tile lx-deep"><div className="lx-ic"><div className="lx-rip"><i /><i /><i /></div></div><h3>Your ripple</h3><p>See how many people your posts reached. Numbers, never names.</p></div>
            <div className="lx-tile lx-ink"><span className="lx-tag"><i />Live</span><div className="lx-ic"><div className="lx-wave"><i /><i /><i /><i /><i /><i /></div></div><h3>Talk Rooms</h3><p>Talk it out live, with a mic or camera. Nothing is recorded.</p></div>
            <div className="lx-tile lx-orange"><div className="lx-ic">🪑</div><h3>Meetings, right now</h3><p>Real AA and NA meetings from their own listings.</p><div className="lx-mtg" aria-hidden="true">⏰ next in {Math.floor(mtg / 60)}:{two(mtg % 60)}</div></div>
            <div className="lx-tile lx-paper"><div className="lx-ic">🌙</div><h3>A plan for 3 a.m.</h3><p>Written on a good day, there for the hard one.</p></div>
            <div className="lx-tile lx-lime"><div className="lx-ic">✋</div><h3>Daily pledge</h3><p>One line a day. The days you showed up.</p></div>
            <div className="lx-tile lx-paper"><div className="lx-ic">📖</div><h3>A reading a day</h3><p>Two minutes, the same reading as everyone.</p></div>
            <div className="lx-tile lx-green"><div className="lx-ic">🛋️</div><h3>Rooms for every path</h3><p>The Front Room, Al-Anon, 7-OH and more.</p></div>
            <div className="lx-tile lx-navy"><div className="lx-ic">💬</div><h3>Chat</h3><p>Your people, one tap away. Someone’s usually up.</p></div>
            <div className="lx-tile lx-purple"><div className="lx-ic">🤫</div><h3>Post anonymously</h3><p>Go anonymous on one post and back. Nobody can tell.</p></div>
            <div className="lx-tile lx-paper lx-wide"><div className="lx-ic">🕯️</div><h3>Somewhere quiet</h3><p>Write what gets you through, on the one wall in here where nobody can reply.</p></div>
          </div>

          {/* ⭐ RecoveryMap — Dr. Nicole Labor's app, now inside Sober Book.
              🔴 She is named as its MAKER, never as endorsing Sober Book. */}
          <a className="lx-rm" href="/rm">
            <div className="lx-rays" aria-hidden="true" />
            <div className="lx-rm-top">
              <img src="/rm/icon-192.png" alt="" width="56" height="56" />
              <div><div className="lx-rm-nm">RecoveryMap</div><div className="lx-rm-by">by Dr. Nicole Labor, DO</div></div>
              <span className="lx-rm-new">INSIDE SOBER BOOK</span>
            </div>
            <h3>A doctor’s map<br />to care.</h3>
            <p>Find treatment, recovery housing, telehealth and free meetings near you.
               Made by a board-certified addiction medicine doctor.</p>
            <div className="lx-stats">
              <div><b>12,916</b><span>programs</span></div><div><b>Every</b><span>state</span></div><div><b>$0</b><span>paid listings</span></div>
            </div>
            <div className="lx-ways"><span>Treatment near you</span><span>Recovery housing</span><span>Telehealth</span><span>Narcan, free</span><span>Quick exit</span></div>
            <div className="lx-rm-go">Open RecoveryMap →</div>
          </a>
        </div>
      </section>

      <section className="lx-sec">
        <div className="lx-wrap">
          <div className="lx-kick">Our promises</div>
          <h2 className="lx-h2">What we’ll<br />never do.</h2>
          <div className="lx-prom">
            <div><span className="lx-x">✕</span><p><b>Sell your information</b>Not to a treatment centre, not to anybody. Ever.</p></div>
            <div><span className="lx-x">✕</span><p><b>Show your email or real name</b>Other members only ever see your handle.</p></div>
            <div><span className="lx-x">✕</span><p><b>Rank people</b>No leaderboards. Day one sits right next to day 1,000.</p></div>
            <div><span className="lx-x">✕</span><p><b>Judge your path</b>Suboxone, MAT, the rooms, your own way. All paths welcome.</p></div>
          </div>
        </div>
      </section>

      <section className="lx-quote">
        <div className="lx-wrap">
          <blockquote>
            Every time I met someone new I’d think, do I tell them? On here I
            don’t have to. Everybody already knows.
            <cite>why we built this</cite>
          </blockquote>
        </div>
      </section>

      <section className="lx-home">
        <div className="lx-burst" aria-hidden="true" />
        <div className="lx-wrap">
          <h2>Come home.</h2>
          <p>No judgment. No hiding. Just people who get it.</p>
          {/* ⚠️ Back to the form, NOT a second email capture. */}
          <button type="button" className="lx-go lx-go-ink" onClick={() => goTo('new')}>
            Make my account <span className="lx-arr">→</span>
          </button>
        </div>
      </section>

      {/* ---- ☕ HELP KEEP THIS APP MOVING ----
           🔴 Landing page only, never in the feed or on /now. rel="noreferrer"
           is not optional. 🔴 HIDDEN INSIDE THE iPHONE APP — Apple 3.1.1; it
           starts hidden and is revealed after mount. ⚠️ 3 Nov: "no ads" and
           "stays free" came out of this copy. */}
      {!iosApp && (
      <section className="lx-coffee">
        <div className="lx-wrap">
          <p className="lx-cofT">Help keep the lights on</p>
          <p className="lx-cofP">
            Sober Book is free to use, and nobody sells anybody&apos;s
            information. It costs a little each month to run, and every
            coffee helps.
          </p>
          <a className="lx-cofB" href="https://buymeacoffee.com/tyhowell07"
             target="_blank" rel="noopener noreferrer">
            ☕ Buy us a coffee
          </a>
        </div>
      </section>
      )}

      <p className="lx-foot">
        Sober Book · a safe place to be yourself · all paths welcome
        {' · '}<a href="/privacy">privacy</a>
        {/* ⚠️ /support is here because the person who most needs it is
            SIGNED OUT, and this is the only page they can reach. */}
        {' · '}<a href="/support">support</a>
      </p>

      {!sent && (
        <div className={`lx-dock${dock ? ' on' : ''}`} aria-hidden={!dock}>
          <button type="button" className="lx-dock-a" tabIndex={dock ? 0 : -1} onClick={() => goTo('new')}>Make my account</button>
          <button type="button" className="lx-dock-b" tabIndex={dock ? 0 : -1} onClick={() => goTo('in')}>Sign in</button>
        </div>
      )}
    </div>
  );
}
