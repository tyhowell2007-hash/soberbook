'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

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

  async function signIn(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('in');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: inEmail, password: inPw,
      });
      if (error) throw error;
      router.push('/'); router.refresh();
    } catch (e2) { setErr(humanise(e2)); }
    finally { setBusy(''); }
  }

  async function signUp(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy('up');
    try {
      const { error } = await supabase.auth.signUp({ email: upEmail, password: upPw });
      if (error) throw error;
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

          <div className="lp-doors" id="join">

            {/* ---------- SIGN IN, first ---------- */}
            <div className="lp-card">
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

            {/* ---------- NEW HERE, directly underneath ---------- */}
            <div className="lp-card lp-new">

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

                <button className="lp-go" type="submit" disabled={!!busy}>
                  {busy === 'up' ? 'One second…' : 'Create my account'}
                </button>
              </form>

              <p className="lp-fineprint">
                Your email is never shown to another member. Ever. Not a
                treatment centre, and nobody sells your information.
              </p>
              </>
              )}
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
