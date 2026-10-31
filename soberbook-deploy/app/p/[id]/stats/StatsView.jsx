'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../../lib/supabase-browser';
import Coin from '../../../components/Coin';
import { COINS, COIN } from '../../../../lib/coins';
import './stats.css';

/* =====================================================================
   "HOW IT'S DOING" — the page.  31 Oct 2026 (0196). Prototype v3, ③.

   ⭐ IT OPENS WITH A SENTENCE, NOT A SPREADSHEET. Ty's rule for this app
   is that numbers serve people; the first thing an author reads is what
   happened, in words. The sections below always come in the same order
   so you always know where to look.

   🔴 NEVER COMPARE. Nothing here ranks this post against your others or
   says "doing worse than last time". The only comparison is to the chip
   days everybody already knows.
   ===================================================================== */

const CHIPS = [10, 30, 90, 365, 1000, 2500, 5000, 10000];
const chipLabel = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));

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
function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

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

  useEffect(() => {
    supabase.rpc('my_post_coins', { p_post: id }).then(({ data }) => setCoins(data || []));
    if (focus === 'coins') {
      setTimeout(() => document.getElementById('coins')?.scrollIntoView({ block: 'start' }), 200);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The moment most coins landed, if any were dropped during a video. */
  const moments = Array.isArray(s.moments) ? s.moments : [];
  let peak = null;
  if (moments.length && dur > 0) {
    const bins = {};
    moments.forEach((m) => { const b = Math.round(Number(m.s) / 2) * 2; bins[b] = (bins[b] || 0) + 1; });
    peak = Number(Object.entries(bins).sort((a, b) => b[1] - a[1])[0][0]);
  }

  /* the opening sentence */
  const verb = vid ? 'watched' : 'saw';
  let sentence;
  if (!seen && !coinTotal) {
    sentence = <>It’s out there. When people {vid ? 'watch' : 'see'} it, you’ll see it here.</>;
  } else {
    sentence = (
      <>
        <b>{seen.toLocaleString()}</b> {seen === 1 ? 'person' : 'people'} in recovery {verb} this.
        {coinTotal ? <> <b>{coinTotal.toLocaleString()}</b> sent you a coin</> : null}
        {coinTotal && peak !== null ? <>, and the most coins landed at <b>{clock(peak)}</b>.</> : coinTotal ? '.' : null}
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

  /* retention curve: share of viewers still watching at each 5% of the video */
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
  const reached = new Map((s.milestones || []).map((m) => [Number(m.n), m.at]));
  const nextChip = CHIPS.find((c) => c > seen);
  const showChips = CHIPS.filter((c) => reached.has(c) || c === nextChip);

  return (
    <main className="stv">
      <div className="stv-top">
        <Link href={`/p/${id}`} className="stv-back">← The post</Link>
        <span className="stv-only">Only you see this</span>
      </div>
      <h1 className="stv-h">How it’s doing</h1>
      {s.body ? <p className="stv-body">“{s.body}”</p> : null}
      <p className="stv-date">Posted {when(s.created_at)} · {ago(s.created_at)}</p>

      <section className="stv-story">
        <p>{sentence}</p>
      </section>

      {vid && curve && base ? (
        <section className="stv-sec">
          <h2>Where people felt it</h2>
          <div className="stv-felt">
            <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
              <path d={area} className="stv-area" />
              <path d={path} className="stv-line" />
            </svg>
            {moments.map((m, i) => (
              <span key={i} className="stv-m" style={{ left: `${Math.min(100, (Number(m.s) / dur) * 100)}%` }}>
                <Coin kind={m.k} size={18} />
              </span>
            ))}
            {peak !== null ? (
              <span className="stv-peak" style={{ left: `${Math.min(92, Math.max(8, (peak / dur) * 100))}%` }}>
                {clock(peak)} · most coins
              </span>
            ) : null}
          </div>
          <div className="stv-axis"><span>0:00</span><span>{clock(dur / 2)}</span><span>{clock(dur)}</span></div>
          <p className="stv-small">The green shape is how many people were still watching at each moment. Coins sit where people dropped them.</p>
          <div className="stv-trio">
            <div><b>{clock(s.avg_seconds)}</b><span>Average watch</span></div>
            <div><b>{seen ? `${Math.round(((Number(s.to_end) || 0) / seen) * 10)} in 10` : '—'}</b><span>To the end</span></div>
            <div><b>{(Number(s.rewatch) || 0).toLocaleString()}</b><span>Watched twice+</span></div>
          </div>
        </section>
      ) : null}

      <section className="stv-sec" id="coins">
        <h2>Coins <span>{coinTotal.toLocaleString()}</span></h2>
        {coinTotal ? (
          <>
            <div className="stv-bar" aria-hidden="true">
              {COINS.map((c) => {
                const n = Number(s.coins?.[c.kind]) || 0;
                return n ? <i key={c.kind} className={'stv-bar-' + c.kind} style={{ width: `${(n / coinTotal) * 100}%` }} /> : null;
              })}
            </div>
            {COINS.filter((c) => Number(s.coins?.[c.kind]))
              .sort((a, b) => Number(s.coins[b.kind]) - Number(s.coins[a.kind]))
              .map((c) => (
                <div key={c.kind} className="stv-crow"><Coin kind={c.kind} size={24} />{c.name}<b>{Number(s.coins[c.kind])}</b></div>
              ))}
            <ul className="stv-who">
              {(coins || []).map((r, i) => (
                <li key={i}>
                  <Coin kind={r.kind} size={28} />
                  <div>
                    <p>
                      {r.who_handle ? <Link href={`/u/${r.who_handle}`}>{r.who}</Link> : <b>{r.who}</b>}
                      {r.note ? <q>{r.note}</q> : <span> sent {COIN[r.kind]?.name}</span>}
                    </p>
                    <span>{ago(r.created_at)}{r.at_seconds != null ? ` · at ${clock(r.at_seconds)}` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="stv-small">No coins yet. When somebody sends one, it lands here with their words.</p>}
      </section>

      <section className="stv-sec">
        <h2>Replies <span>{replies.toLocaleString()}</span></h2>
        <Link href={`/p/${id}`} className="stv-link">{replies ? 'Open the conversation →' : 'Open the post →'}</Link>
      </section>

      <section className="stv-sec">
        <h2>Reach</h2>
        <div className="stv-trio">
          <div><b>{seen.toLocaleString()}</b><span>{vid ? 'Watched' : 'Seen'}</span></div>
          <div><b>+{(Number(s.today) || 0).toLocaleString()}</b><span>Today</span></div>
          {vid
            ? <div><b>{(Number(s.plays) || 0).toLocaleString()}</b><span>Plays</span></div>
            : <div><b>{coinTotal.toLocaleString()}</b><span>Coins</span></div>}
        </div>
        <div className="stv-bars">
          {days.map((d) => (
            <div key={d.d} className="stv-day">
              <em>{Number(d.n) || ''}</em>
              <i style={{ height: `${((Number(d.n) || 0) / dmax) * 100}%` }} />
              <span>{new Date(d.d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stv-sec">
        <h2>Milestone chips</h2>
        <div className="stv-chips">
          {showChips.map((c) => (
            <div key={c} className={'stv-chip' + (reached.has(c) ? '' : ' next')}>
              <span className="stv-med">{chipLabel(c)}</span>
              <span>{reached.has(c) ? when(reached.get(c)) : 'next'}</span>
            </div>
          ))}
        </div>
        <p className="stv-small">Chips follow the days you already know: 10, 30, 90, 365, then 1,000. A post earns them the way you do.</p>
      </section>

      <section className="stv-sec">
        <h2>Your controls</h2>
        {[
          ['show_seen', `Show the ${vid ? 'watched' : 'seen'} number to others`, 'Off: others see the word without a number'],
          ['coin_words', 'Let coins carry words', 'Off: people can still send coins, just without words'],
          ['milestone_bells', 'Milestone bells', 'Off: no milestone notifications for this post'],
        ].map(([k, label, hint]) => (
          <label key={k} className="stv-ctl">
            <span><b>{label}</b><small>{hint}</small></span>
            <input type="checkbox" checked={!!ctl[k]} disabled={saving === k} onChange={() => toggle(k)} />
          </label>
        ))}
      </section>

      <p className="stv-priv"><b>Numbers only.</b> Nobody can see <i>who</i> {vid ? 'watched' : 'saw'} your post: not you, not other members, not the Sober Book team. You only see the names of people who chose to send a coin or reply.</p>
    </main>
  );
}
