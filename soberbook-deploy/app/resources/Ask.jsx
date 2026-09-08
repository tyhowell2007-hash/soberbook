'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HELP_ANSWERS, NO_MATCH } from '../../lib/help-answers';

/* =====================================================================
   ASK ABOUT THE APP.  7 Sept.  Sage's first surface.

   ---------------------------------------------------------------------
   ** THE CHIPS ARE NOT DECORATION AND THEY ARE NOT A FALLBACK.

   The six most-asked questions are buttons. Tapping one shows the
   written answer instantly, with NO network call and NO money spent.
   The box underneath is for the phrasings we did not think of, and only
   that costs anything.

   ⭐ Which means this page works completely with the model switched off,
   out of credit, or timing out. That is the right shape for the first
   thing we ever built on somebody else's service: the common path does
   not depend on them at all.

   ! It is also the honest reading of the survey — two of five silent
   members said they would speak if something asked them a question.
   People tap far more readily than they type.

   ---------------------------------------------------------------------
   ⚠️ EVERY WORD SHOWN HERE COMES OUT OF lib/help-answers.js, INCLUDING
   ON THE MODEL PATH. The route hands back an id's `say` text, never
   anything the model wrote. If that ever changes, this file is where the
   damage would appear, so it must not learn to render free text.
   ===================================================================== */

/* The six worth putting a finger on, in the order people ask them.
   ⚠️ Ids, not copies of the text — a second copy of an answer is a
   second thing to update, and the second one drifts. */
const QUICK = ['anonymous', 'handle', 'date', 'password', 'delete', 'notifications'];

/* Renders **bold** and nothing else. ⚠️ Deliberately not a markdown
   library: the only formatting our answers use is bold on a menu name,
   and a parser that also does links would be a way for text to become
   clickable that nobody reviewed. */
function Rich({ text }) {
  return (
    <>
      {String(text).split(/(\*\*[^*]+\*\*)/).map((bit, i) =>
        bit.startsWith('**') && bit.endsWith('**')
          ? <strong key={i}>{bit.slice(2, -2)}</strong>
          : <span key={i}>{bit}</span>)}
    </>
  );
}

export default function Ask() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState(null);

  function showLocal(id) {
    const hit = HELP_ANSWERS.find((a) => a.id === id);
    if (hit) setAns({ say: hit.say, go: hit.go || null, id: hit.id });
    setQ('');
  }

  async function ask(e) {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/sage/help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: text }),
      });
      const j = await r.json();
      setAns({ say: j.say || NO_MATCH, go: j.go || null, id: j.id || 'nomatch' });
    } catch {
      /* ⚠️ Fails to the same honest sentence as everything else. "Try
         again" would be a guess about whose fault it is. */
      setAns({ say: NO_MATCH, id: 'offline' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sg-wrap">
      <h2 className="sg-h">Ask about the app</h2>
      <p className="sg-lede">
        Sage only knows how Sober Book works. It cannot see your posts,
        your messages, your date, or anything you wrote when you pledged.
      </p>

      <div className="sg-chips">
        {QUICK.map((id) => {
          const a = HELP_ANSWERS.find((x) => x.id === id);
          if (!a) return null;      // an id removed from the answers file just disappears
          return (
            <button key={id} type="button" className="sg-chip"
                    onClick={() => showLocal(id)}>
              {a.ask[0]}
            </button>
          );
        })}
      </div>

      <form className="sg-form" onSubmit={ask}>
        <input
          className="sg-in"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={400}
          placeholder="Or ask it your own way…"
          aria-label="Ask about the app"
        />
        <button type="submit" className="sg-go" disabled={busy || q.trim().length < 2}>
          {busy ? 'Looking…' : 'Ask'}
        </button>
      </form>

      {ans && (
        <div className={'sg-ans' + (ans.id === 'crisis' ? ' sg-urgent' : '')} role="status">
          {/* 🔴 THE LABEL IS NOT OPTIONAL AND IT IS NOT SMALL PRINT.
              It never wears a handle, a face or a day count, because the
              moment it could be mistaken for a member this stops being
              an honest product choice. Same rule that killed "verified,
              real people" off the landing page in August. */}
          <p className="sg-who">◆ SAGE · A ROBOT, NOT A MEMBER</p>
          <p className="sg-say"><Rich text={ans.say} /></p>
          {ans.go && (
            <Link href={ans.go.href} className="sg-take">{ans.go.label} ›</Link>
          )}
        </div>
      )}

      {/* 🔴 THE WAY TO A PERSON IS ALWAYS ON THIS PAGE, not only when
          something triggers. Somebody who cannot find what they need
          from a robot must never have to work out where the humans are. */}
      <p className="sg-out">
        Anything else — <a href="mailto:hello@soberbook.app">hello@soberbook.app</a>.
        A real person reads it.
      </p>
      <Link href="/help" className="sg-help">If you need somebody now ›</Link>
    </div>
  );
}
