'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

export default function Login() {
  const router = useRouter();
  const supabase = browserClient();
  const [mode, setMode] = useState('in');      // 'in' | 'up'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNote(''); setBusy(true);
    try {
      if (mode === 'up') {
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
      setErr(e2.message === 'Invalid login credentials'
        ? "That email and password don't match."
        : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span></div>
      <div className="bar">No steps to prove · no gaps to explain</div>
      <div className="pad">
        <h1>{mode === 'up' ? 'Get in early' : 'Welcome back'}</h1>
        <p className="sub">
          {mode === 'up'
            ? "You pick how you show up next. Nothing is public yet."
            : 'Sign in to pick up where you left off.'}
        </p>

        <form onSubmit={submit}>
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} required autoComplete="email"
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />

          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={pw} required minLength={8}
                 autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                 onChange={(e) => setPw(e.target.value)} placeholder="at least 8 characters" />
          <p className="hint">Your email is never shown to another member. Ever.</p>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'One second…' : mode === 'up' ? 'Create my account' : 'Sign in'}
          </button>
        </form>

        {err && <div className="err">{err}</div>}
        {note && <div className="ok">{note}</div>}

        <button className="linkbtn" type="button"
                onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(''); setNote(''); }}>
          {mode === 'up' ? 'I already have an account' : "I don't have an account yet"}
        </button>
      </div>
    </>
  );
}
