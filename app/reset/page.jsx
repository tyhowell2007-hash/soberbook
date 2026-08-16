'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   Where the reset link lands.

   WHY THIS PAGE HAS TO EXIST AT ALL: without it, `resetPasswordForEmail`
   sends somebody a link to a 404. The email goes out, the person clicks
   it, and the app tells them the page doesn't exist — which is worse
   than having no reset at all, because now they think it's broken AND
   they still can't get in.

   HOW THE LINK WORKS: Supabase puts a recovery token in the URL and the
   browser client trades it for a temporary session as soon as this page
   loads. So by the time somebody types a new password, they are already
   signed in — `updateUser` is all that's left.

   ⚠️ THE GAP THAT MAKES THIS FEEL BROKEN: for a moment on load there is
   no session yet, because the exchange hasn't finished. Render the form
   immediately and a person types a password into a page that will
   reject it. So the page waits for the auth event first and says so.

   ⚠️ AND THE LINK EXPIRES — usually about an hour, and it is single-use.
   Somebody who requests a reset at midnight and gets to it at noon will
   arrive with no session. That is not an error on their part and the
   page does not talk to them like it is.
   ===================================================================== */
export default function ResetPassword() {
  const router = useRouter();
  const supabase = browserClient();

  const [state, setState] = useState('checking');   // checking · ready · expired
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let settled = false;

    /* The recovery token arrives in the URL and the client swaps it for a
       session, firing PASSWORD_RECOVERY when it lands. */
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) { settled = true; setState('ready'); }
      else if (event === 'PASSWORD_RECOVERY') { settled = true; setState('ready'); }
    });

    /* Belt and braces: if the session was already restored before this
       component mounted, no event fires and we'd wait forever. */
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) { settled = true; setState('ready'); }
    });

    /* And if nothing has happened after a few seconds, the link is stale.
       Say so plainly and give them the way to get a fresh one. */
    const t = setTimeout(() => { if (!settled) setState('expired'); }, 4000);

    return () => { sub?.subscription?.unsubscribe(); clearTimeout(t); };
  }, [supabase]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pw !== pw2) { setErr('Those two don’t match. Have another go.'); return; }
    if (pw.length < 8) { setErr('Passwords need to be at least 8 characters.'); return; }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      /* Straight to the Wall. They came here to get back in, not to be
         congratulated and then asked to sign in all over again. */
      router.push('/wall');
      router.refresh();
    } catch (e2) {
      const m = String(e2.message || '');
      setErr(
        /same as the old|should be different/i.test(m)
          ? 'That’s the password you already had. Pick a different one.'
        : /session|expired|token/i.test(m)
          ? 'That link has expired. Ask for a fresh one and it’ll work.'
        : 'Something went wrong on our end, not yours. Try once more.'
      );
      setBusy(false);
    }
  }

  /* Always the warm door. You can only be on this page if you already have
     an account, so there's no first-timer case to switch on. See door.css. */
  return (
    <div className="door back">
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span></div>
      <div className="bar">Nothing here is public</div>
      <div className="pad">

        {state === 'checking' && (
          <>
            <h1>One second</h1>
            <p className="sub">Checking your link.</p>
          </>
        )}

        {state === 'expired' && (
          <>
            <h1>That link’s gone stale</h1>
            <p className="sub">
              Reset links only last about an hour, and they only work once. Nothing
              went wrong and you didn’t break anything — ask for a new one and it’ll
              let you straight in.
            </p>
            <button className="btn" type="button" onClick={() => router.push('/login')}>
              Send me a new link
            </button>
          </>
        )}

        {state === 'ready' && (
          <>
            <h1>Pick a new password</h1>
            <p className="sub">That’s the only thing left. You’re already signed in.</p>

            <form onSubmit={submit}>
              <label htmlFor="p1">New password</label>
              <input id="p1" type="password" value={pw} required minLength={8}
                     autoComplete="new-password" disabled={busy}
                     onChange={(e) => setPw(e.target.value)}
                     placeholder="at least 8 characters" />

              <label htmlFor="p2">Type it again</label>
              <input id="p2" type="password" value={pw2} required minLength={8}
                     autoComplete="new-password" disabled={busy}
                     onChange={(e) => setPw2(e.target.value)}
                     placeholder="just to be sure" />
              <p className="hint">
                Write it down somewhere. Nobody will judge you for it, and it beats
                doing this again in a month.
              </p>

              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save it and take me in'}
              </button>
            </form>

            {err && <div className="err">{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
