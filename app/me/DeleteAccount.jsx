'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/* =====================================================================
   LEAVING — the screen.

   ⚠️ THREE DELIBERATE STEPS, and the friction is the point. This is the
   only control in the app that cannot be undone. Everything else here
   is built to be easy; this one is built to be hard to do by accident
   and impossible to do without understanding what happens.

   ⚠️ IT IS ALSO NOT HIDDEN. Apple requires account deletion to be easy
   to find, and burying it would be the wrong instinct anyway: an exit
   that's hard to locate reads as an app that doesn't want to let you
   go. It sits in Account, one tap from sign-out, plainly labelled.

   ⚠️ AND THE COPY DOES NOT PLEAD. No "are you sure?", no guilt, no
   "we'll miss you", no offer of a discount. People leaving a recovery
   app may be leaving because they relapsed, or because they got well,
   or because their partner found the icon. None of those deserve a
   sales pitch on the way out.
   ===================================================================== */

export default function DeleteAccount({ handle }) {
  const router = useRouter();
  const [step, setStep]   = useState(0);      // 0 closed · 1 choose · 2 confirm
  const [keep, setKeep]   = useState(null);   // true = keep anonymous posts
  const [typed, setTyped] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');

  const matches = typed.trim().toLowerCase() === String(handle).toLowerCase();

  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepAnonymous: keep === true, confirm: typed.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'That did not work. Try again.');
      /* Hard navigation, not router.push. The session is gone and every
         cached server component on this page belongs to an account that
         no longer exists — a soft transition would try to re-render
         them and throw. */
      window.location.href = '/login?gone=1';
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (step === 0) {
    return (
      <>
        <button type="button" className="btn out" onClick={() => setStep(1)}>
          Delete your account
        </button>
        <p className="hint">
          Takes your account and your posts off Sober Book for good.
        </p>
      </>
    );
  }

  return (
    <div className="delbox">
      <h4 className="delh">Leaving</h4>

      {step === 1 && (
        <>
          <p className="delp">
            This cannot be undone. Your account, your replies, your messages,
            your photos and videos all go, and nobody can sign in as you again.
          </p>

          {/* ⚠️ THE ANONYMOUS QUESTION, asked properly rather than decided
              for them. An anonymous post has other people's replies hanging
              off it — deleting it takes somebody else's words with it, and
              keeping it leaves words behind that the author may not want
              anywhere. Only they can weigh that. */}
          <p className="delp">
            What about anything you posted anonymously? Those have no name on
            them, and other people may have replied.
          </p>

          <button type="button"
                  className={'choice' + (keep === false ? ' sel' : '')}
                  aria-pressed={keep === false}
                  onClick={() => setKeep(false)}>
            <span className="ct">Delete everything</span>
            <span className="cd">
              Anonymous posts go too. Any replies underneath them go with them.
            </span>
          </button>

          <button type="button"
                  className={'choice' + (keep === true ? ' sel' : '')}
                  aria-pressed={keep === true}
                  onClick={() => setKeep(true)}>
            <span className="ct">Leave the anonymous ones</span>
            <span className="cd">
              They stay up with no name on them, and the conversations under
              them stay whole. Nothing links them to you — nothing ever did.
            </span>
          </button>

          <div className="delrow">
            <button type="button" className="btn ghost" onClick={() => setStep(0)}>
              Never mind
            </button>
            <button type="button" className="btn"
                    disabled={keep === null}
                    onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="delp">
            {keep
              ? 'Your account and everything with your name on it will be deleted. Anything you posted anonymously stays up, with no way back to you.'
              : 'Everything will be deleted, including your anonymous posts and the replies underneath them.'}
          </p>

          <label className="dellab" htmlFor="delc">
            Type <strong>{handle}</strong> to confirm
          </label>
          {/* ⚠️ autoCapitalize/autoCorrect off. A phone keyboard will
              helpfully capitalise the first letter and then the person
              can't work out why their own handle "doesn't match". The
              server compares case-insensitively too — belt and braces,
              because this failing for a silly reason at this moment is
              its own small cruelty. */}
          <input id="delc" type="text" value={typed} disabled={busy}
                 autoCapitalize="none" autoCorrect="off" spellCheck="false"
                 onChange={(e) => setTyped(e.target.value)} />

          {err && <p className="phserr" role="alert">{err}</p>}

          <div className="delrow">
            <button type="button" className="btn ghost" disabled={busy}
                    onClick={() => { setStep(1); setTyped(''); setErr(''); }}>
              Back
            </button>
            <button type="button" className="btn del" disabled={!matches || busy}
                    onClick={go}>
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
