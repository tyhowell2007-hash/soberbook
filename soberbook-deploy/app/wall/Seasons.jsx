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
            {moves.map((m) => (
              <li key={m.slug}>
                {m.left > 0 ? <><b>{m.left}</b> left {m.emoji} {m.label}</> : null}
                {m.left > 0 && m.joined > 0 ? <> · </> : null}
                {m.joined > 0 ? <><b>{m.joined}</b> moved in</> : null}
              </li>
            ))}
          </ul>
          {/* ⭐ The whole argument of the feature in one sentence. A season
              is temporary; this is the evidence, taken from the room's own
              record rather than from a slogan on a coin. */}
          <p className="sea-turn">Seasons turn. Everybody here has been through one.</p>
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
