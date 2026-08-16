'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

export default function Login() {
  const router = useRouter();
  const supabase = browserClient();
  const [mode, setMode] = useState('in');      // 'in' | 'up' | 'reset'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = mode === 'reset';

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy(true);
    try {
      if (reset) {
        /* ⚠️ THE ONE THING THIS PAGE MUST NEVER DO IS CONFIRM WHO IS A
           MEMBER. Supabase's resetPasswordForEmail already succeeds
           whether or not the address exists, and the message below says
           the same thing either way ON PURPOSE.

           On a recovery app that isn't politeness, it's the whole point:
           anybody who suspects their brother, their boss or their ex has
           an account here could otherwise confirm it by typing their
           address into a login form. "If that address has an account"
           is doing real work in that sentence. */
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (error) throw error;
        setNote('If that address has an account, a reset link is on its way. '
              + 'Check your spam folder too — it hides there more often than not.');
      } else if (mode === 'up') {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setNote('Check your email to confirm, then come back and sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (e2) {
      // Deliberately not echoing whether the address exists — on a recovery
      // product, confirming "yes, this person has an account here" to whoever
      // types an email is a disclosure. Same reason the app never lists members.
      const m = String(e2.message || '');
      setErr(
        m === 'Invalid login credentials'
          ? "That email and password don't match."
        : /already registered|already been registered/i.test(m)
          ? 'There’s already an account on that email. Try signing in, '
            + 'or use “I forgot my password” below.'
        : /rate limit|too many/i.test(m)
          ? 'Too many tries in a row. Give it a few minutes and go again.'
        : /password/i.test(m) && /short|least|weak/i.test(m)
          ? 'Passwords need to be at least 8 characters.'
        /* Catch-all. A person should never be shown a database sentence —
           see the same rule in Me.jsx and the Aug 6 block-RPC leak. */
        : 'Something went wrong on our end, not yours. Try once more, and '
          + 'if it keeps happening tell Ty.'
      );
    } finally {
      setBusy(false);
    }
  }

  /* WHICH DOOR.

     'up' is the only mode a stranger is ever in, so it is the only mode
     that gets the grunge. Signing in and resetting a password are both
     things you can only do if you've been here before, so both get the
     warm one. See app/door.css for why.

     Deriving this from `mode` rather than storing it as its own piece of
     state matters: two sources of truth for "which door" would eventually
     disagree, and the failure would be a first-timer getting the warm
     welcome-back screen — which is worse than ugly, it's a lie about
     whether we know them. */
  const firstTime = mode === 'up';

  /* The heading is built once and placed in one of two containers, rather
     than written out twice. Two copies would drift — the "Get in early"
     line survived three months past the doors opening precisely because it
     existed in more than one place and nobody held all of them in mind. */
  const heading = (
    <>
      <h1>
        {reset ? 'Let’s get you back in'
               : firstTime ? 'The doors are open.'
               : 'Welcome back'}
      </h1>
      <p className="sub">
        {reset
          ? 'Put in your email and we’ll send you a link to set a new password.'
          : firstTime
            ? 'You pick how you show up next. Nothing is public yet.'
            : 'Sign in to pick up where you left off.'}
      </p>
    </>
  );

  return (
    <div className={'door ' + (firstTime ? 'first' : 'back')}>
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span></div>
      <div className="bar">No steps to prove · no gaps to explain</div>

      {/* First-timers get the acid slab: the heading sits in a full-bleed
          field above the form instead of on the page. Everyone else gets
          the heading inside .pad, where the warm door expects it. */}
      {firstTime && (
        <div className="slab">
          <div className="kick">A home for people in recovery</div>
          {heading}
        </div>
      )}

      <div className="pad">
        {!firstTime && heading}

        <form onSubmit={submit}>
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} required autoComplete="email"
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />

          {!reset && (
            <>
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" value={pw} required minLength={8}
                     autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                     onChange={(e) => setPw(e.target.value)} placeholder="at least 8 characters" />
            </>
          )}
          <p className="hint">Your email is never shown to another member. Ever.</p>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'One second…'
              : reset ? 'Send me a link'
              : mode === 'up' ? 'Create my account' : 'Sign in'}
          </button>
        </form>

        {err && <div className="err">{err}</div>}
        {note && <div className="ok">{note}</div>}

        {/* Two doors, always both visible. Somebody locked out at 2am should
            never have to hunt for the way back in — that's the moment they
            give up on the app entirely, and nobody ever finds out they did. */}
        <button className="linkbtn" type="button"
                onClick={() => { setMode(reset ? 'in' : mode === 'up' ? 'in' : 'up');
                                 setErr(''); setNote(''); }}>
          {reset ? 'Back to signing in'
                 : mode === 'up' ? 'I already have an account'
                 : "I don't have an account yet"}
        </button>

        {!reset && (
          <button className="linkbtn" type="button"
                  onClick={() => { setMode('reset'); setErr(''); setNote(''); setPw(''); }}>
            I forgot my password
          </button>
        )}

        {/* Fills the dead space under the form on the warm door, and is
            hidden on the grunge one. Not a pitch — nobody signing back in
            needs selling. */}
        {!firstTime && (
          <p className="porch">
            Nothing you missed needs explaining. Pick up wherever you left it.
          </p>
        )}
      </div>
    </div>
  );
}
