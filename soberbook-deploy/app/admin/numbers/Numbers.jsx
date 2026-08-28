'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

/* =====================================================================
   THE NUMBERS — the live half.

   ---------------------------------------------------------------------
   WHY POLLING AND NOT A REALTIME SUBSCRIPTION

   Supabase can push a message the instant a row is inserted, and that is
   the obvious build for the word "live". It's wrong here for a reason
   that isn't about performance:

   a realtime subscription streams THE ROW. To count posts that way, the
   browser has to be listening to the posts table — including anonymous
   posts, arriving with their author_id attached, in real time. The whole
   anonymity design is a set of views that never hand that column to a
   client, and subscribing would walk around all of it to compute a
   number we can get by asking for the number.

   So: ask a function that returns integers, every 20 seconds. Slower,
   and it cannot leak, because there is nothing in the payload to leak.

   ⚠️ The interval PAUSES when the tab is hidden. Aug 16's lesson said a
   background tab doesn't render; the flip side is that it shouldn't be
   polling either. A phone left open on this page overnight would
   otherwise make ~1,700 pointless calls before morning.
   ===================================================================== */

const EVERY_MS = 20000;

export default function Numbers({ initial }) {
  const supabase = browserClient();
  const [s, setS] = useState(initial);
  const [beat, setBeat] = useState(false);
  const [err, setErr] = useState('');
  const prev = useRef(initial);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function tick() {
      if (document.hidden) return;
      const { data, error } = await supabase.rpc('owner_stats');
      if (!alive) return;
      if (error) { setErr('Lost the connection. Still trying.'); return; }
      setErr('');
      /* Flash only when something actually moved. A number that pulses on
         a timer teaches you to ignore the pulse. */
      if (prev.current && data && data.members !== prev.current.members) {
        setBeat(true); setTimeout(() => setBeat(false), 1400);
      }
      prev.current = data;
      setS(data);
    }

    timer = setInterval(tick, EVERY_MS);
    const wake = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', wake);
    return () => { alive = false; clearInterval(timer);
                   document.removeEventListener('visibilitychange', wake); };
  }, [supabase]);

  const shell = (kids) => (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/wall" className="rt melink">back to the wall ›</Link>
      </div>
      <div className="bar">The numbers</div>
      <div className="pad">{kids}</div>
    </>
  );

  if (!s) {
    return shell(
      <div className="mq-empty">
        <h2>Couldn&rsquo;t read the numbers.</h2>
        {/* ⚠️ Not "0 members". A failure and an empty room look identical
            if you print a zero, and only one of them is true. */}
        <p>That&rsquo;s this page failing, not the app being empty. Reload.</p>
      </div>
    );
  }

  const answered = s.posts - s.unanswered;
  const pct = s.posts ? Math.round((answered / s.posts) * 100) : 0;

  /* The cron runs once a day. 26 hours allows for Vercel's flexible window on
     the Hobby plan (it schedules within an hour) plus a little slack, so this
     only lights up when a run was genuinely MISSED rather than merely late.
     ⚠️ A warning that cries wolf gets ignored, and an ignored warning is the
     same as not having one. */
  const feedStale = s.content_stale_hours == null || s.content_stale_hours > 26;

  return shell(<>
      <p className="hint nm-top">
        Live &mdash; updates on its own every 20 seconds. Counts only.
        Nobody&rsquo;s name is on this page, on purpose.
      </p>

      {err && <p className="phserr" role="status">{err}</p>}

      {/* ---- the one number he asked for, at the size he asked for it - */}
      <section className={'nm-hero' + (beat ? ' beat' : '')}>
        <div className="nm-big">{s.members}</div>
        <div className="nm-lbl">{s.members === 1 ? 'member' : 'members'}</div>
        {s.joined_24h > 0 && (
          <div className="nm-since">
            {s.joined_24h === 1 ? '1 joined' : `${s.joined_24h} joined`} in the last day
          </div>
        )}
      </section>

      <div className="nm-grid">
        <Cell n={s.joined_7d} l="joined this week" />
        <Cell n={s.never_posted} l="never posted"
              warn={s.never_posted > 0}
              note="arrived, said nothing" />
        <Cell n={s.no_profile} l="blank profile" />
        {/* ⚠️ Was s.follows. Following was dropped and friendships replaced it;
            migration 0083 renamed the field in owner_stats() and this line was
            not changed with it, so the tile rendered EMPTY — no error, no zero,
            just a blank number under a label for a feature that no longer
            exists. Found 28 Aug.

            🔴 The lesson is the 0046→0049 one again: when a name changes, the
            producer and every consumer are ONE change. A field read by a key
            that no longer exists fails silently in JavaScript, which is the
            worst possible way for it to fail. */}
        <Cell n={s.friendships} l="friendships" />
      </div>

      {/* ---- the promise, measured -------------------------------------
          "Nobody posts into silence" is the thing this app says out loud.
          This is the only line on the page that checks whether it's true,
          which is why it gets its own box instead of a tile. */}
      <section className="nm-promise">
        <div className="nm-ptop">
          <span className="nm-plbl">Posts that got an answer</span>
          <span className="nm-ppct">{pct}%</span>
        </div>
        <div className="nm-bar"><span style={{ width: `${pct}%` }} /></div>
        <p className="nm-pnote">
          {s.unanswered === 0
            ? 'Everything on the wall has a reply. That is the whole idea, working.'
            : `${s.unanswered} ${s.unanswered === 1 ? 'post is' : 'posts are'} still sitting there with nothing under ${s.unanswered === 1 ? 'it' : 'them'}.`}
        </p>
      </section>

      <div className="nm-grid">
        <Cell n={s.posts} l="posts" note={`${s.posts_24h} today · ${s.posts_7d} this week`} />
        <Cell n={s.replies} l="replies" note={`${s.replies_7d} this week`} />
        <Cell n={s.photos} l="photos" />
        <Cell n={s.videos} l="videos" />
        <Cell n={s.threads} l="chats opened" />
        <Cell n={s.messages} l="messages" />
      </div>

      {/* ---- the feed, and whether it is still breathing ----------------
          🔴 On 28 Aug the content feed had not pulled for 35 hours and there
          was no way to know. The route was fine, the cron was registered and
          enabled on the right schedule — it just had not run, and a stale feed
          looks EXACTLY like a quiet week. The failure and the healthy state
          were visually identical.

          ⚠️ So this line is not a statistic, it is a smoke alarm. It says the
          number of hours out loud rather than a tick, because "fine" and
          "hasn't run since Tuesday" must not render the same way. */}
      <section className={'nm-promise' + (feedStale ? ' warn' : '')}>
        <div className="nm-ptop">
          <span className="nm-plbl">Content feed</span>
          <span className="nm-ppct">
            {s.content_stale_hours == null ? '—' : `${s.content_stale_hours}h`}
          </span>
        </div>
        <p className="nm-pnote">
          {s.content_stale_hours == null
            ? 'No feed source has ever pulled. That is not a quiet day, that is broken.'
            : feedStale
              ? `Last pull was ${s.content_stale_hours} hours ago. It runs daily at 7am — anything past a day means the cron did not fire.`
              : `Last pull ${s.content_stale_hours}h ago · ${s.content_items} cards live.`}
          {s.content_feeds_never_pulled > 0 &&
            ` ${s.content_feeds_never_pulled} source${s.content_feeds_never_pulled === 1 ? ' has' : 's have'} never pulled at all.`}
          {s.content_feeds_erroring > 0 &&
            ` ${s.content_feeds_erroring} erroring.`}
        </p>
      </section>

      <section className="nm-foot">
        <Link href="/admin" className="btn">
          {s.reports_open > 0
            ? `${s.reports_open} report${s.reports_open === 1 ? '' : 's'} waiting`
            : 'Moderation queue'}
        </Link>
        <p className="hint">
          Read at {new Date(s.generated_at).toLocaleTimeString()}.
        </p>
      </section>
  </>);
}

function Cell({ n, l, note, warn }) {
  return (
    <div className={'nm-cell' + (warn ? ' warn' : '')}>
      <div className="nm-n">{n}</div>
      <div className="nm-l">{l}</div>
      {note && <div className="nm-note">{note}</div>}
    </div>
  );
}
