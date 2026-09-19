'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   GROWTH & RETENTION — the client half.  18 Sept 2026.

   ⚠️ NO CHART LIBRARY, ON PURPOSE. One bar chart and a handful of meters
   do not justify ~100KB of Recharts on an app that has kept its bundle
   lean, and every colour here has to come from the app's own measured
   tokens anyway. Plain SVG and plain divs.

   🔴 THE BAR COLOUR IS A VARIABLE THAT CHANGES WITH THE THEME. --gd bars
   on the dark card measure 1.94:1 — the story-ring trap again, found by
   measuring before writing. Dark theme uses --gm-t (12.23). See
   admin.css .gw.
   ===================================================================== */

const SEGMENTS = [
  { key: 'all',     label: 'Everyone' },
  { key: 'posters', label: 'Have posted or replied' },
  { key: 'quiet',   label: 'Never posted (readers)' },
  { key: 'sober',   label: 'Have a sober date' },
  { key: 'anon',    label: 'Anonymous mode' },
  { key: 'open',    label: 'Open mode' },
];

const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const short = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (k, n) => (n ? Math.round((k / n) * 100) : null);

export default function Growth({ initial, launch, today }) {
  const supabase = browserClient();
  const [data, setData]       = useState(initial);
  const [from, setFrom]       = useState(launch);
  const [to, setTo]           = useState(today);
  const [segment, setSegment] = useState('all');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const first = useRef(true);

  const load = useCallback(async (f, t, s) => {
    setBusy(true); setErr('');
    const { data: d, error } = await supabase.rpc('owner_growth', { p_from: f, p_to: t, p_segment: s });
    if (error) setErr('Couldn’t load those numbers. ' + error.message);
    else setData(d);
    setBusy(false);
  }, [supabase]);

  /* The server already fetched the default view — don't fetch it twice. */
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    load(from, to, segment);
  }, [from, to, segment, load]);

  const preset = (days) => { setTo(today); setFrom(days ? addDays(today, -(days - 1)) : launch); };
  const presetOn = (days) => to === today && from === (days ? addDays(today, -(days - 1)) : launch);

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/wall" className="rt melink">back to the wall ›</Link>
      </div>
      <div className="bar">Growth &amp; retention</div>

      <div className="pad gw">
        {/* ---------- filters ---------- */}
        <section className="gw-filters" aria-label="Filters">
          <div className="gw-presets" role="group" aria-label="Date range">
            {[[7, 'Last 7 days'], [30, 'Last 30'], [90, 'Last 90'], [0, 'Since launch']].map(([d, l]) => (
              <button key={l} type="button" className="gw-chip"
                      aria-pressed={presetOn(d)} onClick={() => preset(d)}>{l}</button>
            ))}
          </div>
          <div className="gw-dates">
            <label>From
              <input id="gw-from" type="date" value={from} min={launch} max={to}
                     onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            <label>To
              <input id="gw-to" type="date" value={to} min={from} max={today}
                     onChange={(e) => e.target.value && setTo(e.target.value)} />
            </label>
          </div>
          <label className="gw-segl">Who
            <select id="gw-seg" value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <p className="gw-status" aria-live="polite">
            {busy ? 'Loading…' : data ? `${data.members} members in this group` : ''}
          </p>
          {err && <p className="gw-err" role="alert">{err}</p>}
        </section>

        {!data ? <p className="gw-note">No numbers yet.</p> : (
          <>
            <OpensNote since={data.opensSince} from={data.range.from} />
            <GrowthChart rows={data.growth} />
            <Active a={data.active} />
            <Retention r={data.retention} />
            <Frequency f={data.frequency} />
            <Velocity v={data.velocity} />
            <Depth rows={data.depth} anon={data.anonymousPostsInRange} />
            <p className="gw-foot">
              Numbers only — no names, no ids. Anonymous posts and replies are never
              counted against a person, so nothing here can be used to work out who
              wrote one.{' '}
              <Link href="/admin/numbers">The numbers</Link> ·{' '}
              <Link href="/admin/traffic">Traffic</Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}

/* ⚠️ THE MOST IMPORTANT SENTENCE ON THE PAGE. Before opens were recorded,
   "active" can only mean "did something", so the 87% who read without
   posting look like they left. Every retention figure that reaches back
   before this date undercounts them, and the page must say so where the
   numbers are, not in a comment. */
function OpensNote({ since, from }) {
  if (since && since <= from) return null;
  return (
    <p className="gw-warn">
      <strong>Opening the app is only counted from {since ? short(since) : 'today'}.</strong>{' '}
      Before that, “active” means posted, replied, messaged, reacted or hearted — so members
      who read without doing any of those look like they left. Retention for anyone who joined
      before then is <em>lower here than it really was</em>.
    </p>
  );
}

function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function GrowthChart({ rows }) {
  const [mode, setMode] = useState('new');      // new | total
  const [hi, setHi] = useState(null);
  if (!rows?.length) return null;

  const key = mode === 'new' ? 'n' : 'total';
  const vals = rows.map((r) => r[key]);
  const max = niceMax(Math.max(1, ...vals));
  const W = 640, H = 210, L = 36, B = 24, T = 10, R = 6;
  const iw = W - L - R, ih = H - T - B;
  const bw = iw / rows.length;
  const y = (v) => T + ih - (v / max) * ih;
  const at = hi ?? rows.length - 1;
  const cur = rows[at];
  const sum = rows.reduce((s, r) => s + r.n, 0);

  const pick = (e) => {
    const svg = e.currentTarget;
    const box = svg.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - box.left) / box.width * W;
    const i = Math.floor((cx - L) / bw);
    if (i >= 0 && i < rows.length) setHi(i);
  };

  return (
    <section className="gw-card" aria-labelledby="gw-h-growth">
      <div className="gw-head">
        <h2 id="gw-h-growth">New members</h2>
        <div className="gw-toggle" role="group" aria-label="Show">
          <button type="button" className="gw-chip" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Per day</button>
          <button type="button" className="gw-chip" aria-pressed={mode === 'total'} onClick={() => setMode('total')}>Running total</button>
        </div>
      </div>
      <p className="gw-read" aria-live="polite">
        <span className="gw-rd">{short(cur.d)}</span>
        <span><b>{cur.n}</b> joined</span>
        <span><b>{cur.total}</b> total</span>
        <span className="gw-dim">{sum} in this range</span>
      </p>
      <svg className="gw-svg" viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`${sum} new members between ${short(rows[0].d)} and ${short(rows[rows.length - 1].d)}`}
           onMouseMove={pick} onTouchStart={pick} onTouchMove={pick} onMouseLeave={() => setHi(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="gw-grid" x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} />
            <text className="gw-axis" x={L - 6} y={y(max * f) + 4} textAnchor="end">{Math.round(max * f)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const v = r[key];
          const h = Math.max(v > 0 ? 1.5 : 0, (v / max) * ih);
          return (
            <rect key={r.d} className={'gw-barf' + (i === at ? ' gw-on' : '')}
                  x={L + i * bw + bw * 0.12} width={Math.max(1, bw * 0.76)}
                  y={T + ih - h} height={h} rx={Math.min(3, bw * 0.2)} />
          );
        })}
        {[0, Math.floor((rows.length - 1) / 2), rows.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={i} className="gw-axis" x={L + i * bw + bw / 2} y={H - 6}
                  textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>
              {short(rows[i].d)}
            </text>
          ))}
      </svg>
    </section>
  );
}

function Tile({ n, label, sub, warn }) {
  return (
    <div className={'gw-tile' + (warn ? ' gw-warnt' : '')}>
      <span className="gw-num">{n ?? '—'}</span>
      <span className="gw-lab">{label}</span>
      {sub && <span className="gw-sub">{sub}</span>}
    </div>
  );
}

function Active({ a }) {
  const stick = a.mau ? Math.round((a.dau / a.mau) * 100) : null;
  return (
    <section className="gw-card" aria-labelledby="gw-h-active">
      <h2 id="gw-h-active">Active</h2>
      <div className="gw-tiles">
        <Tile n={a.dau} label="Today" sub="active on the last day" />
        <Tile n={a.wau} label="This week" sub="last 7 days" />
        <Tile n={a.mau} label="This month" sub="last 30 days" />
        <Tile n={stick === null ? '—' : stick + '%'} label="Stickiness" sub="today ÷ this month" />
      </div>
    </section>
  );
}

function Retention({ r }) {
  const rows = [
    ['Next day', 'came back the day after joining', r.d1],
    ['First week', 'came back at least once in days 1–7', r.w1],
    ['First month', 'came back in days 8–30 — after week one', r.m1],
  ];
  return (
    <section className="gw-card" aria-labelledby="gw-h-ret">
      <h2 id="gw-h-ret">Retention</h2>
      <p className="gw-note">Of people who joined in this range and have been members long enough to count.</p>
      {rows.map(([label, sub, x]) => {
        const p = pct(x.kept, x.eligible);
        const thin = x.eligible > 0 && x.eligible < 20;
        return (
          <div key={label} className="gw-row">
            <div className="gw-rowh">
              <span className="gw-rowl">{label}</span>
              <span className="gw-rowv">{p === null ? '—' : p + '%'}</span>
            </div>
            <div className="gw-track" aria-hidden="true"><span className="gw-fill" style={{ width: (p || 0) + '%' }} /></div>
            <p className="gw-sub">
              {sub} · {x.kept} of {x.eligible}
              {thin && <em className="gw-thin"> — too few people to trust yet</em>}
              {x.eligible === 0 && <em className="gw-thin"> — nobody old enough yet</em>}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function Frequency({ f }) {
  const rows = [['1 day', f.one], ['2–3 days', f.twoThree], ['4–6 days', f.fourSix], ['Every day', f.every]];
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="gw-card" aria-labelledby="gw-h-freq">
      <h2 id="gw-h-freq">How often they come</h2>
      <p className="gw-note">
        Days active in the last 7, for everyone active at least once.
        {f.avgDays != null && <> Average <b>{f.avgDays}</b> days.</>}
      </p>
      {rows.map(([l, n]) => (
        <div key={l} className="gw-hb">
          <span className="gw-hbl">{l}</span>
          <span className="gw-track"><span className="gw-fill" style={{ width: (n / max) * 100 + '%' }} /></span>
          <span className="gw-hbn">{n}</span>
        </div>
      ))}
    </section>
  );
}

function Velocity({ v }) {
  const fmt = (x) => (x == null ? '—' : (Math.round(x * 10) / 10) + (x === 1 ? ' day' : ' days'));
  return (
    <section className="gw-card" aria-labelledby="gw-h-vel">
      <h2 id="gw-h-vel">Time between visits</h2>
      <p className="gw-note">For the {v.people} people active on two or more days in this range.</p>
      <div className="gw-tiles">
        <Tile n={fmt(v.median)} label="Typical gap" sub="median" />
        <Tile n={fmt(v.p75)} label="Slower quarter" sub="3 in 4 come back within this" />
      </div>
    </section>
  );
}

function Depth({ rows, anon }) {
  const max = Math.max(1, ...rows.map((r) => r.people));
  return (
    <section className="gw-card" aria-labelledby="gw-h-depth">
      <h2 id="gw-h-depth">What people use</h2>
      <p className="gw-note">
        Ranked by how many different people used it. Only features that leave a record are
        here — reading the wall, the readings, or Find Care leave none.
      </p>
      {rows.length === 0 && <p className="gw-note">Nothing in this range.</p>}
      {rows.map((r) => (
        <div key={r.feature} className="gw-hb">
          <span className="gw-hbl">{r.feature}</span>
          <span className="gw-track"><span className="gw-fill" style={{ width: (r.people / max) * 100 + '%' }} /></span>
          <span className="gw-hbn">{r.people}<span className="gw-dim"> · {r.events}</span></span>
        </div>
      ))}
      <p className="gw-sub">people · times used.
        {anon > 0 && <> Plus {anon} anonymous post{anon === 1 ? '' : 's'}, counted here only as a total.</>}
      </p>
    </section>
  );
}
