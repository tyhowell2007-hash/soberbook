'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../../lib/supabase-browser';
import Coin from '../../../components/Coin';
import { COINS, COIN } from '../../../../lib/coins';
import './stats.css';

/* =====================================================================
   📈 RIPPLE — one post's page, for its author only.
   Was "How it's doing" (31 Oct 2026, 0196). Renamed and redrawn 1 Nov
   2026 after Ty approved the "Ripple" prototype: "make Ripple's
   prototype real." Same data, same order, same promises.

   ⭐ IT OPENS WITH A SENTENCE, NOT A SPREADSHEET. Numbers serve people;
   the first thing an author reads is what happened, in words.

   🔴 NEVER COMPARE. Nothing here ranks this post against your others or
   says "doing worse than last time". The only comparison is to the chip
   days everybody already knows.

   🔴 NO NEW DATA. Everything below comes from post_stats() and
   my_post_coins(), exactly as before. "+N today" on coins is counted in
   the browser from the coin list it already loads.
   ===================================================================== */

const CHIPS = [10, 30, 90, 365, 1000, 2500, 5000, 10000];
const chipLabel = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));
const BAR = { support: '#B97A3C', strength: '#AEB4BB', proud: '#E0B23E', metoo: '#4FA77A' };

function clock(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function when(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
}
function shortDay(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
}
function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
/* "Today" the way the rest of the app means it: the Eastern calendar day. */
const etDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export default function StatsView({ id, s, focus }) {
  const supabase = browserClient();
  const [coins, setCoins] = useState(null);
  const [ctl, setCtl] = useState(s.controls || {});
  const [saving, setSaving] = useState('');

  const vid = !!s.is_video;
  const seen = Number(s.seen) || 0;
  const coinTotal = Number(s.coins?.total) || 0;
  const replies = Number(s.replies) || 0;
  const dur = Number(s.duration) || 0;
  const seenToday = Number(s.today) || 0;

  useEffect(() => {
    supabase.rpc('my_post_coins', { p_post: id }).then(({ data }) => setCoins(data || []));
    if (focus === 'coins') {
      setTimeout(() => document.getElementById('coins')?.scrollIntoView({ block: 'start' }), 200);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = etDay(Date.now());
  const coinsToday = (coins || []).filter((r) => r.created_at && etDay(r.created_at) === today).length;

  /* Where the coins landed on a video: the busiest two-second window. */
  const moments = Array.isArray(s.moments) ? s.moments : [];
  let peak = null;
  if (moments.length && dur > 0) {
    const bins = {};
    moments.forEach((m) => { const b = Math.round(Number(m.s) / 2) * 2; bins[b] = (bins[b] || 0) + 1; });
    peak = Number(Object.entries(bins).sort((a, b) => b[1] - a[1])[0][0]);
  }

  const verb = vid ? 'watched' : 'saw';
  let sentence;
  if (!seen && !coinTotal) {
    sentence = <>It’s out there. When people {vid ? 'watch' : 'see'} it, your ripple shows up here.</>;
  } else {
    sentence = (
      <>
        Your post’s ripple reached <b>{seen.toLocaleString()} {seen === 1 ? 'person' : 'people'}</b> in recovery.
        {coinTotal ? <> <b>{coinTotal.toLocaleString()}</b> sent you a coin</> : null}
        {coinTotal && replies ? <>, and <b>{replies.toLocaleString()}</b> wrote back.</> : null}
        {coinTotal && !replies ? (peak !== null ? <>, most of them at <b>{clock(peak)}</b>.</> : '.') : null}
        {!coinTotal && replies ? <> <b>{replies.toLocaleString()}</b> wrote back.</> : null}
      </>
    );
  }

  async function toggle(key) {
    if (saving) return;
    const want = !ctl[key];
    setSaving(key);
    const args = { p_post: id, p_show_seen: null, p_coin_words: null, p_milestone_bells: null };
    args[{ show_seen: 'p_show_seen', coin_words: 'p_coin_words', milestone_bells: 'p_milestone_bells' }[key]] = want;
    const { data, error } = await supabase.rpc('set_post_controls', args);
    setSaving('');
    if (!error && data) setCtl(data);
  }

  /* The video "where people felt it" shape. */
  const curve = Array.isArray(s.curve) ? s.curve.map(Number) : null;
  const base = curve && curve[0] > 0 ? curve[0] : 0;
  let path = '', area = '';
  if (curve && base) {
    const pts = curve.map((v, i) => [i * 15, 140 - (v / base) * 130]);
    path = 'M' + pts.map((p) => p.join(',')).join(' L');
    area = path + ' L300,150 L0,150 Z';
  }

  const days = Array.isArray(s.days) ? s.days : [];
  const dmax = Math.max(1, ...days.map((d) => Number(d.n) || 0));
  const busiest = days.length && dmax > 0
    ? days.reduce((a, d) => ((Number(d.n) || 0) > (Number(a.n) || 0) ? d : a), days[0]) : null;

  /* Chips: the ones earned, and how far to the next. */
  const reached = new Map((s.milestones || []).map((m) => [Number(m.n), m.at]));
  const nextChip = CHIPS.find((c) => c > seen);
  const prevChip = [...CHIPS].reverse().find((c) => c <= seen) || 0;
  const toNext = nextChip ? nextChip - seen : 0;
  const pct = nextChip ? Math.max(3, Math.min(100, ((seen - prevChip) / (nextChip - prevChip)) * 100)) : 100;
  const earned = CHIPS.filter((c) => reached.has(c));
  const ahead = CHIPS.filter((c) => !reached.has(c) && c >= (nextChip || Infinity)).slice(0, 2);

  return (
    <>
      <div className="mast">
        <Link href={`/p/${id}`} className="back" aria-label="Back to the post">←</Link>
        <span className="lg">📈 Ripple</span>
        <span className="rt">🔒 only you</span>
      </div>

      <main className="rpl">
        <div className="rpl-card rpl-post">
          {s.body ? <p className="rpl-q">{s.body}</p> : <p className="rpl-q rpl-mute">Your post</p>}
          <small>Posted {when(s.created_at)} · {ago(s.created_at)}</small>
        </div>

        <section className="rpl-hero">
          <p>{sentence}</p>
          <div className="rpl-kpis">
            <div><span className="rpl-e">👀</span><b>{seen.toLocaleString()}</b><span>{vid ? 'Watched' : 'Seen'}</span>{seenToday ? <em>+{seenToday.toLocaleString()} today</em> : null}</div>
            <div><Coin kind="proud" size={20} /><b>{coinTotal.toLocaleString()}</b><span>Coins</span>{coinsToday ? <em>+{coinsToday} today</em> : null}</div>
            <div><span className="rpl-e">💬</span><b>{replies.toLocaleString()}</b><span>Replies</span></div>
          </div>
        </section>

        <section className="rpl-card rpl-sec">
          <div className="rpl-sh"><h2><span className="rpl-e">🏅</span>Milestone chips</h2><span>{earned.length} earned</span></div>
          {nextChip ? (
            <div className="rpl-next">
              <Coin kind="proud" size={40} />
              <div>
                <b>{toNext.toLocaleString()} more to the {chipLabel(nextChip)} chip</b>
                <small>Your post earns chips the way you do: 10, 30, 90, 365, 1K</small>
                <div className="rpl-pbar"><i style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          ) : null}
          <div className="rpl-chips">
            {earned.map((c) => <span key={c} className="rpl-chip"><span>✓</span>{chipLabel(c)} · {shortDay(reached.get(c))}</span>)}
            {ahead.map((c) => <span key={c} className="rpl-chip lock"><span>{chipLabel(c)}</span>{c === nextChip ? 'next' : ''}</span>)}
          </div>
        </section>

        {vid && curve && base ? (
          <section className="rpl-card rpl-sec">
            <div className="rpl-sh"><h2><span className="rpl-e">🎬</span>Where people felt it</h2>{peak !== null ? <span>most coins at {clock(peak)}</span> : null}</div>
            <div className="rpl-felt">
              <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
                <path d={area} className="rpl-area" />
                <path d={path} className="rpl-line" />
              </svg>
              {moments.map((m, i) => (
                <span key={i} className="rpl-m" style={{ left: `${Math.min(100, (Number(m.s) / dur) * 100)}%` }}>
                  <Coin kind={m.k} size={18} />
                </span>
              ))}
            </div>
            <div className="rpl-axis"><span>0:00</span><span>{clock(dur / 2)}</span><span>{clock(dur)}</span></div>
            <p className="rpl-small">The green shape is how many people were still watching at each moment. Coins sit where people dropped them.</p>
            <div className="rpl-trio">
              <div><b>{clock(s.avg_seconds)}</b><span>Average watch</span></div>
              <div><b>{seen ? `${Math.round(((Number(s.to_end) || 0) / seen) * 10)} in 10` : '—'}</b><span>To the end</span></div>
              <div><b>{(Number(s.rewatch) || 0).toLocaleString()}</b><span>Watched twice+</span></div>
            </div>
          </section>
        ) : null}

        <section className="rpl-card rpl-sec">
          <div className="rpl-sh"><h2><span className="rpl-e">📅</span>{vid ? 'Watched' : 'Seen'} this week</h2><span>{seen.toLocaleString()} total</span></div>
          <div className="rpl-chart">
            {days.map((d, i) => {
              const n = Number(d.n) || 0;
              const last = i === days.length - 1;
              return (
                <div key={d.d} className={'rpl-col' + (last ? ' today' : '')}>
                  <em>{n}</em>
                  <i style={{ height: `${Math.max(3, (n / dmax) * 100)}%` }} />
                  <span>{last ? 'Today' : new Date(d.d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
                </div>
              );
            })}
          </div>
          {busiest && Number(busiest.n) ? (
            <div className="rpl-foot"><span>Busiest day <b>{new Date(busiest.d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</b></span>
              {vid ? <span>Plays <b>{(Number(s.plays) || 0).toLocaleString()}</b></span> : null}</div>
          ) : null}
        </section>

        <section className="rpl-card rpl-sec" id="coins">
          <div className="rpl-sh"><h2><Coin kind="proud" size={20} />Coins</h2><span>{coinTotal.toLocaleString()} total</span></div>
          {coinTotal ? (
            <>
              <div className="rpl-cbar" aria-hidden="true">
                {COINS.map((c) => {
                  const n = Number(s.coins?.[c.kind]) || 0;
                  return n ? <i key={c.kind} style={{ flex: n, background: BAR[c.kind] }} /> : null;
                })}
              </div>
              {COINS.filter((c) => Number(s.coins?.[c.kind]))
                .sort((a, b) => Number(s.coins[b.kind]) - Number(s.coins[a.kind]))
                .map((c) => {
                  const n = Number(s.coins[c.kind]);
                  return (
                    <div key={c.kind} className="rpl-crow">
                      <Coin kind={c.kind} size={26} />{c.name}
                      <span className="rpl-pct">{Math.round((n / coinTotal) * 100)}%</span><b>{n}</b>
                    </div>
                  );
                })}
              <ul className="rpl-who">
                {(coins || []).map((r, i) => (
                  <li key={i}>
                    <Coin kind={r.kind} size={30} />
                    <div className="rpl-bub">
                      {r.who_handle ? <Link href={`/u/${r.who_handle}`}>{r.who}</Link> : <b>{r.who}</b>}
                      {r.note ? <q>{r.note}</q> : <span>sent {COIN[r.kind]?.name}</span>}
                      <small>{ago(r.created_at)}{r.at_seconds != null ? ` · at ${clock(r.at_seconds)}` : ''}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="rpl-small">No coins yet. When somebody sends one, it lands here with their words.</p>}
        </section>

        <section className="rpl-card rpl-sec">
          <div className="rpl-sh"><h2><span className="rpl-e">💬</span>Replies</h2><span>{replies.toLocaleString()}</span></div>
          <Link href={`/p/${id}`} className="rpl-link">{replies ? 'Open the conversation →' : 'Open the post →'}</Link>
        </section>

        <section className="rpl-card rpl-sec">
          <div className="rpl-sh"><h2><span className="rpl-e">⚙️</span>Your controls</h2></div>
          {[
            ['show_seen', '👀', `Show the ${vid ? 'watched' : 'seen'} number`, `Off: others see “${vid ? 'Watched' : 'Seen'}” without a number`],
            ['coin_words', '✍️', 'Let coins carry words', 'Off: people can still send coins, just no words'],
            ['milestone_bells', '🔔', 'Milestone bells', 'Off: no alerts when this post earns a chip'],
          ].map(([k, e, label, hint]) => (
            <label key={k} className="rpl-ctl">
              <span className="rpl-cico">{e}</span>
              <span className="rpl-ctt"><b>{label}</b><small>{hint}</small></span>
              <input type="checkbox" role="switch" checked={!!ctl[k]} disabled={saving === k} onChange={() => toggle(k)} />
            </label>
          ))}
        </section>

        <p className="rpl-priv"><span className="rpl-e">🔒</span><span><b>Numbers only.</b> Nobody can see <i>who</i> {vid ? 'watched' : 'saw'} your post: not you, not other members, not the Sober Book team. You only see the names of people who chose to send a coin or reply.</span></p>
      </main>
    </>
  );
}
