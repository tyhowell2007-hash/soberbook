'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { fetchWyr, castWyr, share, afterLine } from '../../lib/wyr';

/* =====================================================================
   🎲 WOULD YOU RATHER. The first game in Sober Book.

   ⭐ THE BET: 37 circles exist, average 8.6 people, and almost none of
   them have ever carried a message. The room below this card asks a
   member to WRITE SOMETHING to eight strangers as their first act. This
   asks for one tap, and then hands them a number that is worth arguing
   with in the box underneath.

   🔴 IT RENDERS NOTHING UNTIL IT HAS A QUESTION. No skeleton, no
   spinner, no "loading today's question". A card that announces itself
   and then turns out to be empty is worse on this screen than no card,
   because the screen it sits on is already about a room that might be
   empty. Same stance as the circle room's own `if (!data) return null`.

   ⚠️ NOT OPTIMISTIC. The bars only move after the server says the vote
   landed — the circle room takes the same position for the same reason
   (a message that appears and then silently failed has somebody
   believing eight people saw something nobody did). A poll that shows
   you a tally built on your own unsaved vote is that bug with numbers.
   ===================================================================== */

export default function WouldYouRather() {
  const supa = browserClient();
  const [q, setQ] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    fetchWyr(supa).then((d) => { if (live) setQ(d); });
    return () => { live = false; };
    /* eslint-disable-next-line */
  }, []);

  async function pick(choice) {
    if (!q || busy) return;
    /* Tapping the one you already picked is a no-op, not a round trip. */
    if (q.my_choice === choice) return;
    setBusy(true); setErr('');
    const ok = await castWyr(supa, q.prompt_id, choice);
    if (!ok) { setBusy(false); setErr("That didn't save. Try once more?"); return; }
    /* 🔴 RE-READ rather than patching the counts locally. The server
       decides whether this member is allowed to see the circle split at
       all (0164, rule 2), and a client that does its own arithmetic will
       happily print a tally the server was withholding on purpose. */
    const fresh = await fetchWyr(supa);
    setBusy(false);
    if (fresh) setQ(fresh);
  }

  if (!q) return null;

  const voted = !!q.my_choice;
  const showBars = voted && q.circle_a !== null && q.circle_a !== undefined;
  const [pa, pb] = showBars ? share(q.circle_a, q.circle_b) : [0, 0];

  function opt(key, text, n, pct) {
    return (
      <button type="button"
              className={q.my_choice === key ? 'wyr-opt wyr-mine' : 'wyr-opt'}
              onClick={() => pick(key)}
              disabled={busy}
              aria-pressed={q.my_choice === key}>
        <span>{text}</span>
        {showBars ? (
          <>
            <span className="wyr-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
            {/* ⚠️ The bar is decorative and hidden from screen readers —
                this line is the real one, and it carries both the share
                and the raw count so nobody has to trust a percentage of
                eight people. */}
            <span className="wyr-num">{pct}% &middot; {n} of {q.circle_voters}</span>
          </>
        ) : null}
      </button>
    );
  }

  return (
    <section className="wyr">
      <p className="wyr-q">Would you rather&hellip;</p>

      <div className="wyr-opts">
        {opt('a', q.option_a, q.circle_a, pa)}
        {opt('b', q.option_b, q.circle_b, pb)}
      </div>

      {voted ? <p className="wyr-after">{afterLine(q)}</p> : null}
      {err ? <p className="wyr-err">{err}</p> : null}

      {/* ⚠️ Both halves stated on the screen, not just enforced in the
          schema — the promise only works if people know about it.
          🔴 "Nobody is told what you picked" is literally true: wyr_today()
          returns counts and never a handle, and no view joins a vote to a
          profile. If that ever stops being true, this sentence comes out
          in the same commit. */}
      <p className="wyr-fine">
        {voted
          ? 'You can change your mind — tap the other one. Nobody is told what you picked.'
          : 'Nobody is told what you picked, and there’s no right answer. A new one every day.'}
      </p>
    </section>
  );
}
