'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* =====================================================================
   TRAFFIC — the live half.  15 Sept 2026.

   ---------------------------------------------------------------------
   🔴 THE ONE BEHAVIOUR THAT MATTERS, AND IT IS WHY THIS PAGE EXISTS:
   WHEN THE READ FAILS, IT KEEPS THE LAST GOOD NUMBERS AND SAYS SO.

   The artifact this replaces went BLANK the moment its connector
   refused a call — so at 21:17 on 15 Sept the dashboard stopped
   existing, and the only thing it communicated was "broken", which is
   indistinguishable from "the app is broken". It wasn't. The app was
   serving 299 members the whole time.

   ⭐ A stale number you can see, correctly labelled as an hour old, is
   worth enormously more than a blank screen — and it is the honest
   thing, because the data really is still true, it is just old. So:
   `stale` is set, the last good payload is kept on screen, and the
   stamp turns amber and starts counting. Nothing is hidden and nothing
   is silently presented as current.

   ⚠️ The mirror of the rule that has bitten this project all month
   (a check that cannot fail is not a check): a dashboard that cannot
   tell you it is stale is not a dashboard.

   ---------------------------------------------------------------------
   ⚠️ POLLING PAUSES ON A HIDDEN TAB, copied deliberately from
   Numbers.jsx. A phone left open on this page overnight would otherwise
   make ~1,700 pointless calls before morning.

   ⚠️ EVERY COLOUR BELOW WAS MEASURED BEFORE THIS COMMENT WAS WRITTEN,
   because four unmeasured contrast figures went into this codebase
   wrong in a single day and every one of them was a failure:
     ink    #E8F3EA on card  #16201A ...... 14.69
     muted  #8FA894 on card  #16201A ....... 6.53
     dim    #7A9280 on panel #121A14 ....... 5.28
     acid   #C6F24E on card  #16201A ...... 12.91
     bar    #5C8A68 on panel #121A14 ....... 4.47   (graphic, floor 3.0)
     today  #C6F24E on panel #121A14 ...... 13.70
     border #5E7A66 on panel #121A14 ....... 3.76
     stale  #E8B75C on card  #16201A ....... 9.05
   Control: #C6F24E on #D9F58A returns 1.07, so the function can fail.

   🔴 THE BORDER IS LOAD-BEARING AND MUST NOT BE "TIDIED" DARKER. The
   card fill measures 1.06 against the panel — fill against fill, which
   is the 17 Aug pale-tag bug. Without a visible edge the cards do not
   exist. My first pick was #2A3A2E at 1.47 and the cards vanished.
   ===================================================================== */

const EVERY_MS = 20000;

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const clock = (iso) => new Date(iso).toLocaleTimeString([], {
  hour: 'numeric', minute: '2-digit',
});

/* A row of small bars. ⚠️ Heights are a share of THIS row's own peak,
   not of a shared scale — messages run 5× posts, so one scale would
   flatten posts into a dead line and hide the thing you are looking
   for. The number on the right is the real one; the bars are shape. */
function Spark({ data, today }) {
  const peak = Math.max(1, ...data.map((d) => d.n));
  return (
    <span className="tvspark">
      {data.map((d, i) => (
        <i
          key={d.day}
          style={{ height: `${Math.max(3, (d.n / peak) * 100)}%` }}
          className={i === data.length - 1 ? 'tvnow' : undefined}
          title={`${d.day}: ${d.n}`}
        />
      ))}
      {today}
    </span>
  );
}

export default function Traffic() {
  const [d, setD] = useState(null);
  const [stale, setStale] = useState(false);
  const [first, setFirst] = useState(true);
  const last = useRef(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch('/api/admin/traffic', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        last.current = j;
        setD(j);
        setStale(false);
      } catch {
        /* 🔴 Keep whatever we had. Do NOT clear `d`. */
        if (alive && last.current) setStale(true);
      } finally {
        if (alive) setFirst(false);
      }
    }

    tick();
    const timer = setInterval(tick, EVERY_MS);
    const wake = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  if (!d) {
    return (
      <div className="tvwrap">
        <div className="tvhead">
          <span className="tvtitle">TRAFFIC</span>
          <Link href="/wall" className="tvback">BACK TO THE WALL ›</Link>
        </div>
        <p className="tvnote">{first ? 'Reading…' : 'Could not read the numbers. Still trying.'}</p>
      </div>
    );
  }

  const t = d.totals;
  const peak = Math.max(1, ...d.series.joined.map((x) => x.n));

  return (
    <div className="tvwrap">
      <div className="tvhead">
        <span className="tvtitle">TRAFFIC</span>
        <Link href="/wall" className="tvback">BACK TO THE WALL ›</Link>
      </div>

      <p className={stale ? 'tvstamp tvbad' : 'tvstamp'}>
        {stale
          ? `Can't reach the app right now — these are from ${clock(d.readAt)}, ${ago(d.readAt)}. Still trying.`
          : `Live — updates on its own every 20 seconds. Read at ${clock(d.readAt)}. Counts only, nobody's name is on this page.`}
      </p>

      <div className="tvcards">
        <div className="tvcard"><b>{d.joinedToday}</b><span>JOINED TODAY</span></div>
        <div className="tvcard"><b>{d.joinedWeek}</b><span>JOINED THIS WEEK</span></div>
        <div className="tvcard"><b>{d.joinedAvg30}</b><span>/DAY AVG (30d)</span></div>
        <div className="tvcard tvhero"><b>{t.members}</b><span>MEMBERS, ALL TIME</span></div>
      </div>

      <div className="tvlabel">PEOPLE WHO JOINED, PER DAY — LAST 30</div>
      <div className="tvchart">
        {d.series.joined.map((x, i) => (
          <i
            key={x.day}
            style={{ height: `${Math.max(2, (x.n / peak) * 100)}%` }}
            className={i === d.series.joined.length - 1 ? 'tvnow' : undefined}
            title={`${x.day}: ${x.n}`}
          />
        ))}
      </div>
      <div className="tvaxis">
        <span>{d.days[0]}</span>
        <span>best day {d.best.n} · {d.best.day || '—'}</span>
        <span className="tvtoday">today · {d.joinedToday}</span>
      </div>

      <div className="tvlabel">AND WHAT EVERYONE DID, SAME DAYS</div>
      <div className="tvrows">
        <div className="tvrow">
          <span>Posts</span>
          <Spark data={d.series.posts.slice(-14)} />
          <em>{d.series.posts[d.series.posts.length - 1].n} today</em>
          <u>{t.posts} all time</u>
        </div>
        <div className="tvrow">
          <span>Replies</span>
          <Spark data={d.series.replies.slice(-14)} />
          <em>{d.series.replies[d.series.replies.length - 1].n} today</em>
          <u>{t.replies} all time</u>
        </div>
        <div className="tvrow">
          <span>Messages</span>
          <Spark data={d.series.messages.slice(-14)} />
          <em>{d.series.messages[d.series.messages.length - 1].n} today</em>
          <u>{t.messages} all time</u>
        </div>
        <div className="tvrow">
          <span>In the rooms</span>
          <Spark data={d.series.room.slice(-14)} />
          <em>{d.series.room[d.series.room.length - 1].n} today</em>
          <u>{t.roomMessages} all time</u>
        </div>
      </div>

      <p className="tvfoot">
        Days end at midnight Eastern. This page reads your own database
        directly — there is nothing outside the app that can take it down.
      </p>
    </div>
  );
}
