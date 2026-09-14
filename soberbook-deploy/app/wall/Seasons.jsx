'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { fetchSeasons, peopleLine, movementLines } from '../../lib/seasons';

/* =====================================================================
   🌦️ WHAT SEASON ARE YOU IN.

   Ty, 11 Sept: "in recovery we talk about what season someone is in",
   and then the line that made it a community feature rather than a
   profile field: "people want to see other peoples seasons as well so
   they dont feel so alone."

   ⭐ THE POINT OF THE WORD IS THAT IT IS TEMPORARY. A season is not a
   rank and not a diagnosis — it is where you are this month. So a member
   on day 9 and a member on day 3,102 can be in the same one, as equals.
   That is impossible with a day count, which is why this is declared and
   never computed.

   🔴 IT LIVES IN THE FEED, NOT IN SETTINGS. Ty asked for it here
   specifically. This app's most repeated failure is building the thing
   and hiding the way in — thirteen separate times since August, from
   delete-your-post to the notification bell. A season picker behind the
   profile pencil would have been the fourteenth.
   ===================================================================== */

export default function Seasons({ initialSeason = null }) {
  const supa = browserClient();
  const [mine, setMine] = useState(initialSeason);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try { setData(await fetchSeasons(supa)); } catch { /* see below */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mine]);

  async function pick(slug) {
    if (busy) return;
    setBusy(true); setErr('');
    const { error } = await supa.rpc('set_my_season', { s: slug });
    setBusy(false);
    /* ⚠️ NOT optimistic. A season is a small public statement about how
       you are doing; one that appears and then silently fails would have
       you believing the room can see something it cannot. Same call as
       the block button (29 Aug) — the things that describe you to other
       people wait for the database. */
    if (error) { setErr("That didn't save. Try once more?"); return; }
    setMine(slug);
  }

  /* Nothing at all until the first load returns. ⚠️ A skeleton here would
     flash an empty picker at somebody who already chose. */
  if (!data) return null;

  const list = data.counts || [];
  const chosen = list.find((c) => c.slug === mine);

  /* -------------------------------------------------------------------
     NOT PICKED YET — the ask. Deliberately the whole card, because the
     room's weather means nothing to somebody who hasn't said where they
     are standing in it. */
  if (!mine) {
    return (
      <section className="sea" aria-label="What season are you in">
        <h2 className="sea-h">🌦️ What season are you in?</h2>
        <p className="sea-sub">Seasons change. That&rsquo;s the point of the word.</p>
        <div className="sea-pick">
          {list.map((s) => (
            <button key={s.slug} type="button" className="sea-opt"
                    disabled={busy} onClick={() => pick(s.slug)}>
              <span className="sea-em" aria-hidden="true">{s.emoji}</span>
              <span className="sea-txt">
                <span className="sea-lab">{s.label}</span>
                <span className="sea-blurb">{s.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        {err ? <p className="sea-err">{err}</p> : null}
        <p className="sea-fine">Everyone can see it. You can change it any time, and nobody is told when you do.</p>
      </section>
    );
  }

  /* -------------------------------------------------------------------
     PICKED — the room's weather. This is the screen Ty chose.
     ------------------------------------------------------------------- */
  const moves = movementLines(data.moved);

  return (
    <section className="sea" aria-label="Where everyone is">
      <h2 className="sea-h">Where everyone is</h2>
      <p className="sea-sub">
        {chosen ? <>You&rsquo;re in {chosen.emoji} {chosen.label}</> : 'tonight'}
      </p>

      {/* ⭐ 14 Sept — THIS MOVED UP HERE FROM THE BOTTOM, at Nic's ask:
          "that should be at the top of the feature since that's how you
          learn about what it is and how it works." He is right — it was
          the last thing on the card, so the only person who ever read it
          was somebody who had already scrolled past the thing it explains.
          ⚠️ It now carries BOTH halves of "what this is" — the turn and
          the how-to — in one paragraph. `.sea-fine` on the not-picked-yet
          screen is deliberately left alone: there it sits directly under
          the buttons it describes, which is already the right place.
          🔴 The cost, recorded because it is real: "Seasons turn" used to
          sit UNDER the movement list, where the list was its evidence.
          Up here it is a claim made before the proof. Ty took that trade
          knowingly. If it ever reads as a slogan, split it back — the
          explainer stays top, "Seasons turn" goes back under the list. */}
      <p className="sea-turn">
        Seasons turn. Everybody here has been through one. Pick the one that
        fits &mdash; change it any time, and nobody is told when you do.
      </p>

      <ul className="sea-bars">
        {list.map((s) => {
          /* ⚠️ The bar is scaled against the BIGGEST season, not against
             the membership. Against 243 members every bar is a sliver and
             the screen reads as "almost nobody is here", which is both
             wrong and discouraging. */
          const top = Math.max(...list.map((x) => x.n || 0), 1);
          const w = s.n ? Math.max(8, Math.round((s.n / top) * 100)) : 0;
          return (
            <li key={s.slug} className={s.slug === mine ? 'sea-row sea-me' : 'sea-row'}>
              <div className="sea-rowtop">
                <span className="sea-name"><span aria-hidden="true">{s.emoji}</span> {s.label}</span>
                <span className="sea-n">{peopleLine(s)}</span>
              </div>
              {/* 🔴 No bar at all below three. Drawing a sliver would put
                  the count back on screen as a LENGTH, which is the same
                  disclosure the number was withheld to prevent. */}
              {w ? <div className="sea-bar"><i style={{ width: `${w}%` }} /></div> : null}
            </li>
          );
        })}
      </ul>

      {moves.length ? (
        <div className="sea-moved">
          <h3 className="sea-h3">This month</h3>
          <ul>
            {/* 🔴 14 Sept — NIC FOUND THIS AND IT IS NOT A RENDERING FAULT.
                He said "it seems to be missing some text in certain lines",
                and the old shape was:

                  {left  > 0 ? <b>{left}</b> left {emoji} {label} : null}
                  {both      ? ' · ' : null}
                  {joined> 0 ? <b>{joined}</b> moved in : null}

                THE SEASON WAS ONLY EVER NAMED INSIDE THE `left` BRANCH.
                So a season nobody left this month rendered as a bare
                "7 moved in" — moved in to WHAT. Measured live the day he
                reported it: 2 of 5 lines had no season on them at all.

                ⭐ It looks intermittent because it IS intermittent — it
                depends entirely on whether anybody happened to leave that
                season this month, so it moves around as the data does.
                That is why it reads as "certain lines" rather than as a
                broken feature, and why nobody caught it for three days.

                ⚠️ MY FIRST HYPOTHESIS WAS WRONG AND IS RECORDED SO NOBODY
                REPEATS IT: I assumed invisible text, because 13 Sept was
                exactly that (`.sea-turn` at 1.04:1). Measured all thirteen
                text pairs in this card in both themes first — the worst is
                5.12 and every one passes. Contrast was never the problem.
                Measure before believing the shape of the last bug.

                ✅ Ty picked "season first, always" off a mockup. The season
                is now the SUBJECT of every line instead of a detail that
                only appears when somebody leaves, so the line cannot lose
                its noun no matter what the numbers do. It also reads as a
                column, which matches the bars directly above it. */}
            {moves.map((m) => (
              <li key={m.slug}>
                <span aria-hidden="true">{m.emoji}</span> {m.label}
                {' — '}
                {m.left > 0 ? <><b>{m.left}</b> left</> : null}
                {m.left > 0 && m.joined > 0 ? <>, </> : null}
                {m.joined > 0 ? <><b>{m.joined}</b> moved in</> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="sea-change">
        <summary>Change my season</summary>
        <div className="sea-pick">
          {list.map((s) => (
            <button key={s.slug} type="button" className="sea-opt"
                    disabled={busy || s.slug === mine} onClick={() => pick(s.slug)}>
              <span className="sea-em" aria-hidden="true">{s.emoji}</span>
              <span className="sea-txt">
                <span className="sea-lab">{s.label}</span>
                <span className="sea-blurb">{s.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        {err ? <p className="sea-err">{err}</p> : null}
      </details>
    </section>
  );
}
