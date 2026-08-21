'use client';

import { useEffect, useState, useCallback } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   WHAT'S ON NEXT — and, above it, WHERE PEOPLE ARE GOING.

   Ty, Aug 17: "I like the idea of seeing where my friends are gonna go to
   meetings... if they're going to meetings online, which one to go and
   meet them at?"

   That second sentence is the whole product. Every app on earth can list
   meetings — AA and NA publish the data openly, anybody can render it.
   Nobody can tell you WHICH ROOM YOUR PEOPLE WILL BE IN. That's not a
   feature we bolted on; it's the only thing here that can't be copied,
   because it's made of the members and not of data.

   ⚠️ WHY THIS IS A CLIENT COMPONENT WHEN IT RENDERS NO FORM

   Timezones. The server has no idea what time it is where you are — it
   runs in whatever region Vercel put it, and if it rendered "8:00 PM" it
   would be printing its own clock at you. Only the browser knows your
   zone. So the server ships the raw facts (a weekday, an hour, and the
   meeting's own zone) and the browser does the arithmetic.

   ⚠️ AND WHY IT'S SORTED BY "NEXT", NOT BY DAY

   A grid of Sunday-through-Saturday tabs answers "what happens Tuesday".
   Nobody opens this page to ask that. They open it at half eleven on a
   bad night to ask "where can I go, now".
   ===================================================================== */

const MS_DAY = 86400000;
const WD = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };

function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}

/* Turn a wall-clock time in some zone into a real instant.

   ⚠️ The loop is not superstition. There is no built-in "this local time,
   in that zone, is this UTC moment" — Intl only goes the other way. So we
   guess, ask what the guess looks like over there, and correct by the
   error. Twice, because correcting once can land on the far side of a DST
   boundary and be an hour out. Two passes settles it. */
function zonedToUtc(y, mo, d, hh, mi, tz) {
  let ts = Date.UTC(y, mo - 1, d, hh, mi);
  for (let i = 0; i < 2; i++) {
    const g = partsIn(new Date(ts), tz);
    const seen = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute);
    ts -= seen - ts;
  }
  return ts;
}

/* Returns the instant AND the calendar date in the MEETING's zone.

   ⚠️ onDate is the meeting's local date, not yours, and that matters.
   It's the key identifying WHICH Tuesday somebody said they'd attend.
   Using the viewer's date would mean two members in different timezones
   marking the same meeting write two different rows and never see each
   other — the feature would silently half-work, which is worse than not
   working at all. The meeting's own date is the one fact everybody
   agrees on. */
function nextStart(m, nowMs) {
  if (!m.tz) return null;
  for (let add = 0; add <= 7; add++) {
    const g = partsIn(new Date(nowMs + add * MS_DAY), m.tz);
    if (WD[g.weekday] !== m.day) continue;
    const ts = zonedToUtc(+g.year, +g.month, +g.day, m.hour, m.minute, m.tz);
    /* A meeting that started up to 20 minutes ago still counts. Walking in
       late is normal and always has been; hiding it would be the app being
       stricter than the rooms are. */
    if (ts >= nowMs - 20 * 60000) {
      return { ts, onDate: `${g.year}-${g.month}-${g.day}` };
    }
  }
  return null;
}

function whenLabel(ts, nowMs) {
  const mins = Math.round((ts - nowMs) / 60000);
  if (mins <= 0 && mins > -20) return { t: 'Started just now', live: true };
  if (mins < 60) return { t: `In ${mins} min`, live: true };

  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date(nowMs);
  if (d.toDateString() === today.toDateString())
    return { t: `Today ${time}`, live: false };
  if (d.toDateString() === new Date(nowMs + MS_DAY).toDateString())
    return { t: `Tomorrow ${time}`, live: false };
  return { t: `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`, live: false };
}

/* Names, not a count. "Jacoby and Ivy" is a reason to go; "2 going" is a
   statistic about strangers. */
function nameList(others) {
  const n = others.length;
  if (n === 0) return null;
  if (n === 1) return others[0];
  if (n === 2) return `${others[0]} and ${others[1]}`;
  if (n === 3) return `${others[0]}, ${others[1]} and ${others[2]}`;
  return `${others[0]}, ${others[1]} and ${n - 2} others`;
}

/* =====================================================================
   🔴 THE JOIN LINK IS DIFFERENT ON A LAPTOP AND ON A PHONE.

   Ty, twice: "I still can't get in."

   What was happening on the laptop: our link is zoom.us/j/<id>?pwd=<code>.
   Zoom's first page ACCEPTS the passcode — the URL even ends in
   "#success" — and then, when you click "Join from browser", it hands you
   to app.zoom.us/wc/<id>/join WITHOUT the pwd. The passcode box comes
   back, empty, on the very screen you were trying to reach.

   ⚠️ Last night I tested /wc/join/?pwd= , SAW it skip the passcode, and
   chose /j/ anyway because Zoom's web client is unreliable on phones.
   That reasoning wasn't wrong — it was incomplete. I never followed the
   /j/ path to its END on a desktop, so I never saw where the passcode got
   dropped. **Testing the first hop is not testing the journey.**

   So: the door depends on the device.
     PHONE   → /j/<id>?pwd=  — deep-links into the Zoom app, which keeps
               the passcode. The web client is the bad option here.
     DESKTOP → /wc/join/<id>?pwd=  — goes straight to the name box.
               Verified on a live meeting: passcode box gone.

   ⚠️ Anything that isn't a plain Zoom /j/ link is returned untouched.
   ===================================================================== */
function webClientHref(link) {
  try {
    const u = new URL(link);
    if (!/(^|\.)zoom\.us$/i.test(u.hostname)) return link;
    const id = u.pathname.match(/\/j\/(\d+)/);
    if (!id) return link;
    const out = new URL(`https://${u.hostname}/wc/join/${id[1]}`);
    const pwd = u.searchParams.get('pwd');
    if (pwd) out.searchParams.set('pwd', pwd);
    return out.toString();
  } catch { return link; }
}

export default function List({ meetings, fetchedAt, source, going: initialGoing }) {
  /* ⚠️ null until mounted, on purpose. The server has no clock that means
     anything to this reader, so it renders no times at all — if it guessed
     and the browser disagreed, React would throw a hydration mismatch and
     the page would flicker between two different wrong answers. Empty then
     correct beats wrong then corrected. */
  const [rows, setRows] = useState(null);
  /* ⚠️ The UNSLICED set. `rows` is capped at 60 for display, which
     barely covers today — so a meeting that started yesterday and is
     STILL RUNNING falls off the end. That is exactly the 2am meeting,
     so the "right now" button must search all of them, not the page. */
  const [allRows, setAllRows] = useState([]);
  /* ⚠️ false until mounted. The server has no idea what device this
     is, and guessing would mean a hydration mismatch — same reason
     `rows` starts null. */
  const [onPhone, setOnPhone] = useState(false);
  useEffect(() => {
    setOnPhone(
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
       /android|iphone|ipad|ipod/i.test(navigator.userAgent))
    );
  }, []);
  const [showClosed, setShowClosed] = useState(true);
  const [going, setGoing] = useState(initialGoing || []);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  /* Meetings other members couldn't get into, and the ones I flagged.
     Keyed "source|meeting_id" — a flag is about the ROOM, not about one
     Tuesday, so unlike "I'm going" it deliberately carries no date. */
  const [flags, setFlags] = useState({});
  const [myFlags, setMyFlags] = useState({});
  const [flagging, setFlagging] = useState(null);

  useEffect(() => {
    const supabase = browserClient();
    let alive = true;
    (async () => {
      const [{ data: counts }, { data: { user } }] = await Promise.all([
        supabase.from('meeting_flag_counts').select('*').eq('kind', 'needs_account'),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      const c = {}; (counts || []).forEach((r) => { c[r.source + '|' + r.meeting_id] = r.n; });
      setFlags(c);
      if (user) {
        const { data: mine } = await supabase
          .from('meeting_flags').select('source, meeting_id')
          .eq('kind', 'needs_account').eq('reporter_id', user.id);
        if (!alive) return;
        const m = {}; (mine || []).forEach((r) => { m[r.source + '|' + r.meeting_id] = true; });
        setMyFlags(m);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ⚠️ NOT optimistic, and not because of speed. If the write fails the
     button must not claim the next person has been warned when they
     haven't. Same call as the block button (Aug 6) and the friend button
     — a state that only LOOKS like it worked is the dangerous kind here. */
  async function flagIt(m, kind) {
    const fk = source + '|' + m.id;
    setFlagging(fk); setErr('');
    try {
      const supabase = browserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');
      if (myFlags[fk]) {
        const { error } = await supabase.from('meeting_flags').delete()
          .eq('source', source).eq('meeting_id', m.id)
          .eq('kind', kind).eq('reporter_id', user.id);
        if (error) throw error;
        setMyFlags((x) => { const n = { ...x }; delete n[fk]; return n; });
        setFlags((x) => ({ ...x, [fk]: Math.max(0, (x[fk] || 1) - 1) }));
      } else {
        const { error } = await supabase.from('meeting_flags')
          .insert({ source, meeting_id: m.id, kind, reporter_id: user.id });
        if (error) throw error;
        setMyFlags((x) => ({ ...x, [fk]: true }));
        setFlags((x) => ({ ...x, [fk]: (x[fk] || 0) + 1 }));
      }
    } catch (e) {
      setErr("Couldn't save that.");
    } finally { setFlagging(null); }
  }

  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      const out = [];
      for (const m of meetings) {
        const nx = nextStart(m, now);
        if (!nx) continue;   // no zone we trust → not shown with a time
        out.push({ ...m, ts: nx.ts, onDate: nx.onDate, when: whenLabel(nx.ts, now) });
      }
      out.sort((a, b) => a.ts - b.ts);
      out.sort((a, b) => a.ts - b.ts);
      setAllRows(out);
      setRows(out.slice(0, 60));
    };
    compute();
    /* Re-run every minute so "In 12 min" doesn't quietly become a lie while
       somebody sits reading the page. */
    const id = setInterval(compute, 60000);
    return () => clearInterval(id);
  }, [meetings]);

  const mark = useCallback(async (m, currentlyGoing) => {
    setBusy(m.id + m.onDate); setErr('');
    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign('/login'); return; }

    /* ⚠️ NOT optimistic. The UI waits for the database.

       A mark that only LOOKS like it saved is worse than one that visibly
       failed: somebody thinks they've told the room they're coming, and
       nobody sees it. Same reasoning as the block button on Aug 6 — for
       anything another person relies on, correctness beats snappiness. */
    if (currentlyGoing) {
      const { error } = await supabase.from('meeting_going').delete()
        .eq('member_id', user.id).eq('source', source.id)
        .eq('meeting_id', m.id).eq('occurs_on', m.onDate);
      if (error) { setErr('Couldn’t update that. Try again.'); setBusy(null); return; }
      setGoing((g) => g.filter(
        (r) => !(r.meeting_id === m.id && r.occurs_on === m.onDate && r.is_mine)
      ));
    } else {
      const { error } = await supabase.from('meeting_going').insert({
        member_id: user.id, source: source.id, meeting_id: m.id, occurs_on: m.onDate,
      });
      if (error) { setErr('Couldn’t update that. Try again.'); setBusy(null); return; }
      setGoing((g) => [...g, {
        source: source.id, meeting_id: m.id, occurs_on: m.onDate,
        handle: '__me__', display_name: 'You', display_avatar: null, is_mine: true,
      }]);
    }
    setBusy(null);
  }, [source]);

  if (rows === null) {
    return <div className="pad"><p className="mt-dim">Working out the times where you are…</p></div>;
  }

  const visible = showClosed ? rows : rows.filter((r) => r.access !== 'closed');

  /* =====================================================================
     ⭐ "TAKE ME TO ONE NOW."

     Ty, 2am: "find a way to make it extremely easy to get into the rooms."

     At 2am nobody wants a list. A list is a decision, and a decision is
     the thing a person in a bad moment has least of. This is one tap to a
     door that is open right now.

     What it will not do is send somebody somewhere that fails. In order:
       • happening RIGHT NOW (started, not finished) — not "in 40 minutes"
       • nobody has reported it asking for a Zoom account
       • open to anyone, or unstated — never a closed meeting, because
         being asked to leave at 2am is worse than not going
       • has a real link
     ⚠️ If nothing qualifies, it says so plainly rather than picking the
     least-bad option. Sending someone to a locked door is the failure
     this whole night was about.
     ===================================================================== */
  /* ⚠️ TWO occurrences are checked, not one, and the second is the whole
     point. `ts` is the NEXT start. A meeting that began BEFORE now and is
     still going has its next start in the future — so a naive `ts <= now`
     misses it.

     That is not an edge case, it is the 2am case. The N.A.N.A. 24/7 room
     runs 1440 minutes; at 1:49am it has been going twenty hours and its
     "next start" is 5am. Shipped this an hour ago saying "nothing running"
     while the one meeting that is always open sat directly underneath.

     A week back is the right offset: the feed lists one row per weekday,
     so the record whose next start is next Wednesday had its previous
     session yesterday. ⚠️ That record sits ~6 days out, far past the 60
     shown on screen — which is why this searches `allRows`, not `rows`. */
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const runningAt = (r) => {
    const dur = (r.minutes || 60) * 60000;
    const now = Date.now();
    const inWindow = (start) => start <= now && now < start + dur;
    return inWindow(r.ts) || inWindow(r.ts - WEEK);
  };

  const liveNow = allRows.filter((r) => {
    if (!r.link) return false;
    if ((flags[source + '|' + r.id] || 0) > 0) return false;
    if (r.access === 'closed') return false;
    return runningAt(r);
  });

  const endsAt = (r) => {
    const dur = (r.minutes || 60) * 60000;
    const now = Date.now();
    return (r.ts <= now && now < r.ts + dur) ? r.ts + dur : r.ts - WEEK + dur;
  };

  /* 🔴 RANKING, and the first rule is the one I got wrong.
     v1 sorted purely by "longest still to run", so a 24-hour room won
     every time — including the one room we know demands a Zoom account,
     while two OPEN meetings that had just started sat right beneath it.
     Duration is the weakest signal here, not the strongest.

     In order of what actually matters to somebody at 2am:
       1. ENOUGH TIME LEFT — at least 20 minutes. Walking in as a meeting
          closes is its own small humiliation.
       2. KNOWN OPEN beats "not stated". Being asked to leave is worse
          than not going, so certainty is worth more than convenience.
       3. Only then, more time remaining.

     ⚠️ 1 and 2 were the other way round at first, and a written-out test
     caught it: an open meeting with five minutes left beat an unknown one
     with five hours. Ordering the tie-breaks is the whole design here —
     get it wrong and the button is confidently useless. */
  const MIN_LEFT = 20 * 60000;
  const score = (r) => {
    const left = endsAt(r) - Date.now();
    return [
      left >= MIN_LEFT ? 1 : 0,      // long enough to be worth going
      r.access === 'open' ? 1 : 0,   // then: certain you're welcome
      left,                          // then whatever runs longest
    ];
  };
  const rightNow = liveNow.sort((a, b) => {
    const A = score(a), B = score(b);
    for (let i = 0; i < A.length; i++) if (B[i] !== A[i]) return B[i] - A[i];
    return 0;
  })[0] || null;

  const peopleFor = (m) =>
    going.filter((g) => g.meeting_id === m.id && g.occurs_on === m.onDate);

  /* ⚠️ A meeting appears in ONE list, never both.

     If it showed up top AND below, you'd see the same meeting twice and
     have to work out which one is real. Lifting it out is what makes the
     top section a place rather than a duplicate. */
  const withPeople = visible.filter((m) => peopleFor(m).length > 0);
  const rest       = visible.filter((m) => peopleFor(m).length === 0);

  function Card({ m, inPanel }) {
    const here  = peopleFor(m);
    const mine  = here.some((g) => g.is_mine);
    const others = here.filter((g) => !g.is_mine);
    const names = nameList(others.map((g) => g.display_name));
    const key   = m.id + m.onDate;
    const fkey  = source + '|' + m.id;
    const flagged  = (flags[fkey] || 0) > 0;
    const mineFlag = !!myFlags[fkey];
    /* Running right now — the same test the big button uses, so the two
       can never disagree about what "open" means. */
    const live = runningAt(m);
    const faces = others.slice(0, 4);

    return (
      <div className={inPanel ? 'mt-pcard' : 'mt-card' + (m.when.live ? ' now' : '')}>

        {/* In the panel, WHO comes first — that's the reason you're reading
            this card. In the main list, WHEN comes first, because there the
            question is "what can I get to". Same data, different question. */}
        {inPanel && (names || mine) && (
          <div className="mt-going">
            <span className="mt-faces" aria-hidden="true">
              {faces.map((f, i) => <span key={i} className="mt-face">{f.display_avatar || '🙂'}</span>)}
            </span>
            <span className="mt-goingt">{names ? (mine ? `You and ${names}` : names) : 'You'}</span>
          </div>
        )}

        {!inPanel && <div className="mt-when">{m.when.t}</div>}
        <div className="mt-name">{m.name}</div>
        {inPanel && <div className="mt-pwhen">{m.when.t}</div>}

        <div className="mt-tags">
          {m.access === 'open'   && <span className="mt-tag open">Open to anyone</span>}
          {m.access === 'closed' && <span className="mt-tag closed">For people in recovery</span>}
          {/* ⚠️ 'unknown' is shown as unknown. Never rounded up to "open" —
              that's the guess that gets somebody turned away at a door. */}
          {m.access === 'unknown' && <span className="mt-tag unk">Not stated — ask the group</span>}
          {m.minutes ? <span className="mt-tag dur">{m.minutes} min</span> : null}
        </div>

        {/* Outside the panel the social line goes UNDER the meeting, because
            there it's a bonus fact rather than the headline. */}
        {!inPanel && names && (
          <div className="mt-going">
            <span className="mt-faces" aria-hidden="true">
              {faces.map((f, i) => <span key={i} className="mt-face">{f.display_avatar || '🙂'}</span>)}
            </span>
            <span className="mt-goingt">
              {mine ? `You and ${names} are going` : `${names} ${others.length === 1 ? 'is' : 'are'} going`}
            </span>
          </div>
        )}

        <div className="mt-go">
          {m.link && (
            /* noreferrer as well as noopener: the meeting host has no
               business learning the click came from a recovery app. */
            /* 🔴 A MEETING THAT HASN'T STARTED MUST NOT LOOK LIKE ONE
               THAT HAS.

               Ty: "I can get into the first one, but not the rest of
               them." He was right, and it was never the link. At 10:23pm
               exactly one meeting was running and the rest all started at
               10:30 — so every other Join dropped him into Zoom's
               "waiting for the host" screen, which is indistinguishable
               from being locked out.

               ⚠️ The button was identically green and identically
               confident either way. The app knew the meeting hadn't
               started — it says "IN 7 MIN" two lines above — and then
               offered the same door anyway.

               Now the button says what will happen. You can still go
               early and wait, which is a real thing people do; you just
               aren't told it's open when it isn't. */
            <a className={'mt-join' + (live ? '' : ' mt-join-early')}
               href={onPhone ? m.link : webClientHref(m.link)}
               target="_blank" rel="noopener noreferrer">
              {live ? 'Join ↗' : `Opens ${m.when.toLowerCase()} ↗`}
            </a>
          )}
          <button type="button"
                  className={'mt-going-btn' + (mine ? ' on' : '')}
                  aria-pressed={mine}
                  disabled={busy === key}
                  onClick={() => mark(m, mine)}>
            {/* "I'm going TOO" when somebody's already there. Different act,
                different words — you're joining a person, not picking a
                meeting off a list. */}
            {busy === key ? '…' : mine ? '✓ I’m going' : (names ? 'I’m going too' : 'I’m going')}
          </button>
        </div>

        {/* ⚠️ THIS LINE USED TO SAY "No Zoom account needed — join as a
            guest." FULL STOP, ON EVERY MEETING. It was not true.

            Some groups set their own room to "signed-in Zoom accounts
            only". Zoom enforces that before anyone gets in, NA's feed
            doesn't publish the setting, and we cannot detect it — both
            Zoom pages are drawn by JavaScript, so a server fetch reads
            an empty document.

            Ty hit that wall at 1:40am on the only meeting running. The
            promise sent him to a locked door. Same category as the
            "verified, real people" claim removed on Aug 15: a
            reassurance the app can't keep is worse than no reassurance,
            because somebody believes it at the worst possible moment. */}
        {/* ⭐ CALL IN. The way past a "signed-in Zoom accounts only" room —
            a telephone caller has no Zoom account, so the host's setting
            cannot apply to them.

            One tap dials the number, the meeting id and the passcode; the
            commas in a tel: URL are pauses. 29 of 61 meetings publish a
            number and until tonight every one was plain text you had to
            copy out by hand.

            ⚠️ It moves ABOVE the Join button when somebody has reported
            being asked to sign in — at that point it isn't the fallback,
            it's the door. */}
        {m.tel && (
          <a className={'mt-call' + (flagged ? ' mt-call-first' : '')} href={m.tel}>
            ☎ Call in{flagged ? ' — no Zoom account needed' : ''}
          </a>
        )}

        {m.link && (
          flagged ? (
            <div className="mt-noacct mt-warn">
              Someone here got asked to sign in to Zoom for this one.
            </div>
          ) : (
            <div className="mt-noacct">
              Most groups let you straight in as a guest — a few ask you to
              sign in to Zoom.
            </div>
          )
        )}

        {/* ⭐ The list teaches itself. One tap from the person who hit the
            wall warns everyone behind them.

            ⚠️ It never HIDES the meeting — a flag adds a warning and
            nothing else. One annoyed tap must not be able to delete
            somebody's meeting from the only list they have at 2am. */}
        {m.link && (
          <button type="button" className="mt-cantget"
                  disabled={flagging === fkey}
                  onClick={() => flagIt(m, 'needs_account')}>
            {mineFlag ? '✓ you said this one asks you to sign in'
                      : 'Couldn’t get in?'}
          </button>
        )}

        {/* ⚠️ THE LINK IS NOT THE ONLY DOOR AND MUST NOT LOOK LIKE IT.
            Tapping a Zoom link on a phone drops you into Zoom's funnel:
            install the app, or sign in. Joining is free and needs no
            account, but "Join from your browser" is buried. For somebody at
            2am, a sign-up wall and a paywall feel identical — they close the
            phone. So the meeting ID and dial-in get real weight. The phone
            number matters most: it skips smartphones altogether. */}
        {(m.note || m.phone) && (
          <div className="mt-how">
            {m.note  && <div className="mt-id">{m.note}</div>}
            {m.phone && <div className="mt-id">☎ {m.phone}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pad">

      {/* One tap, before anything else on the page. */}
      {rightNow ? (
        <a className="mt-now" href={onPhone ? rightNow.link : webClientHref(rightNow.link)} target="_blank" rel="noopener noreferrer">
          <span className="mt-nowh">Take me to a meeting now</span>
          <span className="mt-nows">
            {rightNow.name} · going on right now
          </span>
        </a>
      ) : (
        /* ⚠️ Says WHY there's nothing, and still offers the list. An empty
           promise here reads as "even this doesn't want me". */
        <div className="mt-now mt-nownone">
          <span className="mt-nowh">Nothing running this minute</span>
          <span className="mt-nows">The next one is below — or the 24/7 rooms always have someone.</span>
        </div>
      )}

      {/* ⚠️ THE OPEN/CLOSED CONTROL EXISTS BECAUSE OF WHO ELSE IS HERE.
          A closed meeting is for people who have the addiction themselves.
          Some members won't have a sober date — they're here for somebody
          else, or to understand it. Sending one of them to a closed meeting
          means she shows up and is asked to leave.

          Defaults to SHOWING everything, because most members here do have
          the addiction. The switch is how you say which one you are without
          telling the app which one you are — nothing is stored. */}
      <button type="button" className="mt-filter" aria-pressed={!showClosed}
              onClick={() => setShowClosed((v) => !v)}>
        {showClosed ? 'Show only meetings open to everyone' : 'Showing open meetings only · show all'}
      </button>

      {err && <div className="err">{err}</div>}

      {/* ⭐ WHERE PEOPLE ARE GOING.

          ⚠️ The whole panel is absent when nobody is going anywhere. No
          empty state, no "nobody yet", no zero. With four members a
          permanently empty section makes the place look abandoned and you
          stop looking at it — the same reasoning that killed the presence
          dots in the chat directory. Absence says nothing; presence says
          something. */}
      {withPeople.length > 0 && (
        <section className="mt-panel" aria-labelledby="mt-panel-h">
          <h2 id="mt-panel-h" className="mt-panelh">Where people are going</h2>
          {withPeople.map((m) => <Card key={m.id + m.onDate} m={m} inPanel />)}
        </section>
      )}

      {visible.length === 0 && (
        <p className="mt-dim">Nothing in the next seven days matches that. Try showing all.</p>
      )}

      {rest.length > 0 && (
        <>
          {withPeople.length > 0 && <div className="mt-resth">Everything else</div>}
          {rest.map((m) => <Card key={m.id + m.onDate} m={m} />)}
        </>
      )}

      {/* Attribution is not decoration. These are volunteers who published
          their data so apps could use it; the least we do is say whose it is
          and send people back to them. */}
      <div className="mt-src">
        <p>
          Meeting times and links come from <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>,
          who publish them openly so apps like this can list them. Sober Book isn&apos;t
          affiliated with {source.fellowship} and doesn&apos;t speak for them.
        </p>
        <p className="mt-dim">
          {fetchedAt ? `List checked ${new Date(fetchedAt).toLocaleString()}. ` : ''}
          Groups change times without telling anybody — if one is wrong, the
          fellowship&apos;s own finder is the source of truth.
        </p>
      </div>
    </div>
  );
}
