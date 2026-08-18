'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Thread from './Thread';
import PostMenu from './PostMenu';
import PhotoUpload from '../components/PhotoUpload';

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

/* The sizing rule. The second clause is the important one: an unanswered
   post gets BIGGER.

   ⚠️ BUT ONLY ONE AT A TIME, AND THAT LIMIT IS THE WHOLE MECHANIC.

   The first version grew EVERY unanswered post over two hours old. On a
   busy wall that's rare and it works. On a wall with six posts and two
   members, almost nothing has a reply yet — so three quarters of the
   page turned into full-width acid slabs and the special state became
   the ordinary one.

   A signal that fires constantly is not a signal. It's wallpaper. And
   worse than wallpaper here: a wall of giant unanswered posts reads as
   "this place is dead", which is the exact opposite of what the rule
   was built to say.

   So exactly one post is ever promoted for being ignored — the one that
   has been waiting LONGEST. Not the newest: the promise is "nobody
   posts into silence", and the person who has been sitting there
   unanswered the longest is the one that promise is about.

   Milestones are exempt from the cap. They're rare by nature, and a
   celebration and a plea should never compete for the same slot. */
function weight(p, isLoneliest) {
  if (p.milestone_days) return 'poster';
  if (isLoneliest) return 'poster';
  if (p.comment_count > 0) return 'card';
  return p.body.length < 90 ? 'scrap' : 'card';
}

/* Which single post has been waiting longest with nobody answering.
   Returns an id, or null when the wall is fully answered — which is the
   state we actually want and the one where nothing shouts at all. */
function loneliest(list) {
  const now = Date.now();
  const waiting = list.filter(
    (p) => !p.milestone_days
        && p.comment_count === 0
        && now - new Date(p.created_at).getTime() > TWO_HOURS
  );
  if (!waiting.length) return null;
  return waiting.reduce((oldest, p) =>
    new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest
  ).id;
}

/* A SEPARATE question from weight(): is this big because it's a milestone,
   or big because nobody answered?

   They look identical on screen and they mean opposite things — one is a
   celebration, the other is a person being ignored. We only ever say the
   second one out loud, and only to other people. */
function unanswered(p) {
  return !p.milestone_days
    && p.comment_count === 0
    && Date.now() - new Date(p.created_at).getTime() > TWO_HOURS;
}

/* The name on a post, linked to that person's page — or NOT linked, which
   is the part that matters.

   `author_handle` comes out of feed_posts nulled on exactly the same
   condition as author_id: anonymous post, no handle. So this function
   cannot accidentally build a link to an anonymous author even if someone
   later changes the markup around it — there is simply nothing to link
   with.

   Doing it the obvious way — linking `/u/${p.display_name}` — would have
   been a disaster in two directions at once. For an anonymous post,
   display_name is a per-thread alias, so the link would be broken AND
   would announce that an alias maps to a real address. For an open member
   it's their real name, which isn't their handle, so the link would 404
   for everyone with a space in their name. The rule is: never build an
   identity link out of a display string. */
function who(p) {
  if (!p.author_handle) return p.display_name;
  return (
    <Link href={`/u/${p.author_handle}`} className="wholink">
      {p.display_name}
    </Link>
  );
}

/* `me` defaults rather than being required, so this component still
   renders if it's ever mounted without it — a missing name should cost
   you a greeting, never a blank page. */
export default function Wall({ initial, me = { name: null, avatar: null }, mark = null,
                               photoUrls = {} }) {
  const router = useRouter();
  const supabase = browserClient();
  /* The milestone landing today, if there is one and it hasn't been
     answered. Server decides whether to send it; this only renders it. */
  const [offer, setOffer] = useState(mark);
  const [posts, setPosts] = useState(initial);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);

  /* ---- the photo on the post being written (0022) ----
     { path, preview } or null. `path` is what the database stores;
     `preview` is a local object URL so the picture appears the instant
     it's chosen rather than after a round trip. */
  const [photo, setPhoto] = useState(null);

  /* Links for photos uploaded during THIS session, merged over the ones
     signed on the server at page load. Without this a new post appears
     with an empty frame until the next full refresh — the poster is the
     one person who can't see what they just posted, which reads as the
     upload having failed. */
  const [freshUrls, setFreshUrls] = useState({});
  const urlFor = (p) => (p ? (freshUrls[p] || photoUrls[p] || null) : null);

  /* ⚠️ TURNING ANONYMITY ON DROPS THE PHOTO, AND SAYS SO.

     0022 makes it impossible for an anonymous post to carry a photo — the
     database rejects the insert outright. So without this, tapping the
     anonymous chip with a picture attached produces a raw constraint
     error at Post time, which is both ugly and far too late: the choice
     was made several seconds earlier.

     Removing it silently would be worse still. Somebody would post
     anonymously believing the photo went with it, and only the absence of
     a complaint would ever tell them otherwise.

     So: it goes, and the composer says it went and why. The rule is
     enforced in the database and EXPLAINED in the interface. */
  const [photoDropped, setPhotoDropped] = useState(false);

  function toggleAnon() {
    const next = !anon;
    if (next && photo) { setPhoto(null); setPhotoDropped(true); }
    else setPhotoDropped(false);
    setAnon(next);
  }

  /* After the client re-reads the feed, the rows carry photo PATHS and no
     links — the server signed the previous batch, not this one.

     ⚠️ Without this, posting made everyone else's photos disappear until
     router.refresh() came back: `posts` updates immediately, `photoUrls`
     is a prop and doesn't. Pictures blinking out because you posted
     something reads as your post having broken the page.

     Only paths we don't already hold are asked for, so the common case —
     posting into a wall that's already loaded — costs nothing. */
  async function signMissing(rows) {
    const need = [];
    for (const r of rows || []) {
      for (const p of [r.photo_url, r.display_avatar_photo]) {
        if (p && !freshUrls[p] && !photoUrls[p]) need.push(p);
      }
    }
    if (!need.length) return;
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [...new Set(need)] }),
      });
      const { urls } = await res.json();
      if (urls) setFreshUrls((u) => ({ ...u, ...urls }));
    } catch {
      /* Swallowed on purpose. A photo that doesn't appear is a worse
         page; an error banner about signing URLs on top of somebody's
         wall is a broken app. The text is all still there. */
    }
  }

  /* ⚠️ ONE EFFECT, NOT THREE CALL SITES.

     The feed is re-read in three places — refresh(), the milestone share,
     and post() — and a fourth will exist eventually. Calling signMissing
     from each is the obvious version and it is wrong in a specific way:
     the day somebody adds a fifth re-read and forgets, photos silently
     stop appearing on that one path only. That bug is invisible in review
     and miserable to reproduce.

     Watching `posts` instead means the rule is "whenever the feed
     changes, make sure its pictures have links" — which is the actual
     requirement, stated once.

     It terminates because signMissing only sets state when something is
     genuinely missing, and what it fetches is exactly what was missing.
     Second pass finds nothing and stops. */
  useEffect(() => { signMissing(posts); /* eslint-disable-line */ }, [posts]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);     // the post whose thread is open
  const [menu, setMenu] = useState(null);     // the post whose ⋯ menu is open
  // post ids with a like request in the air. Without this, an impatient
  // double-tap fires insert AND delete at once and the heart ends up
  // disagreeing with the database.
  const [pending, setPending] = useState(() => new Set());

  // Re-read the wall so the reply count updates — and with it, which post
  // carries the acid edge. Answering somebody literally takes the mark off
  // their post and moves it to whoever has been waiting next longest.
  // The layout is the promise.
  async function refresh() {
    const { data } = await supabase
      .from('feed_posts').select('*').order('created_at', { ascending: false }).limit(60);
    if (data) {
      setPosts(data);
      setOpen((o) => (o ? data.find((p) => p.id === o.id) || o : o));
    }
  }

  /* LIKE — optimistic.

     The heart flips BEFORE the database is asked. A like that waits ~300ms
     for a round trip feels broken, and people tap it again, which is how
     you get double-fires. So: move the UI now, send the request, and put
     it back only if the request actually failed.

     The trade is that for a moment the screen shows something that isn't
     true yet. That's fine for a heart. It would NOT be fine for anything
     with consequences — a post, a payment, a sign-out. */
  async function like(p) {
    if (pending.has(p.id)) return;                 // already in flight
    const nowLiked = !p.liked_by_me;

    setPending((s) => new Set(s).add(p.id));
    setPosts((list) => list.map((x) => x.id === p.id
      ? { ...x, liked_by_me: nowLiked, like_count: x.like_count + (nowLiked ? 1 : -1) }
      : x));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = nowLiked
        ? await supabase.from('likes').insert({ post_id: p.id, user_id: user.id })
        /* The .eq() here is NOT the security check — RLS already refuses to
           delete anyone else's like. It answers a different question:
           "which of MY likes?" Authorisation and selection are separate
           jobs, and the database only does the first one. */
        : await supabase.from('likes').delete().eq('post_id', p.id);
      if (error) throw error;
    } catch (e) {
      // put the heart back exactly where it was
      setPosts((list) => list.map((x) => x.id === p.id
        ? { ...x, liked_by_me: !nowLiked, like_count: x.like_count + (nowLiked ? -1 : 1) }
        : x));
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  }

  /* Answering the milestone offer — share it, or don't.

     ⚠️ THE CARD DISAPPEARS FIRST, BEFORE ANY NETWORK CALL.
     Whichever they pick, the answer has been given and the app should
     stop asking immediately. Leaving it on screen spinning while a write
     completes reads as the app not accepting "no" — which is the one
     thing this whole design exists to avoid.

     ⚠️ THE POST IS WRITTEN BEFORE THE ANSWER IS RECORDED, and the order
     is deliberate. If recording the answer fails, they get asked again
     tomorrow — annoying. If the post fails but the answer is recorded,
     the celebration is silently lost and can never be offered again,
     because the milestone only lands once. Better the recoverable
     failure. */
  async function answerMilestone(share) {
    const mk = offer;
    if (!mk) return;
    setOffer(null);
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (share) {
        /* milestone_days carries the REAL day count, computed on the
           SERVER from sober_since and handed down in `mark`. For '1 year'
           that's 365 or 366 depending on whether a leap day fell inside
           it — the true figure, and the same one their profile shows. A
           hardcoded 365 would contradict their own counter on screen.

           ⚠️ Not recomputed here from Date.now(). The client's clock and
           timezone are not the server's, and a phone an hour ahead of UTC
           would post a day count one off from the one it just displayed. */
        const { error } = await supabase.from('posts').insert({
          author_id: user.id,
          body: `${mk.full} today.`,
          /* NEVER anonymous. A milestone post is a disclosure by
             definition — "someone hit 90 days" attached to no one is not
             a celebration, it's noise. If they want it unattached they
             can decline and write their own post. */
          is_anonymous: false,
          milestone_days: mk.days,
        });
        if (error) throw error;

        const { data } = await supabase
          .from('feed_posts').select('*').order('created_at', { ascending: false }).limit(60);
        setPosts(data || []);
      }

      /* Record the answer either way. Read-then-append rather than
         overwrite, so two tabs open at once can't wipe each other's
         history. Not airtight against a true simultaneous write — the
         honest fix is a Postgres array_append in an RPC — but the failure
         mode is being asked about one old milestone again, which is
         harmless enough not to justify the extra surface tonight. */
      const { data: prof } = await supabase
        .from('profiles').select('milestones_answered').eq('id', user.id).maybeSingle();
      const seen = new Set(prof?.milestones_answered || []);
      seen.add(mk.key);
      await supabase.from('profiles')
        .update({ milestones_answered: [...seen] }).eq('id', user.id);

      router.refresh();
    } catch (e2) {
      alert(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function post(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      /* ⚠️ `anon ? null : …` looks redundant next to the CHECK constraint
         in 0022, and it is — deliberately. The database is the wall; this
         line is so a member never MEETS the wall. Belt and braces, where
         the braces produce a readable app and the belt produces a
         guarantee. */
      const { error } = await supabase.from('posts')
        .insert({ author_id: user.id, body, is_anonymous: anon,
                  photo_url: anon ? null : (photo?.path || null) });
      if (error) throw error;
      setText('');
      setPhoto(null);
      setPhotoDropped(false);
      // re-read through the VIEW, never the base table
      const { data } = await supabase
        .from('feed_posts').select('*').order('created_at', { ascending: false }).limit(60);
      setPosts(data || []);
      router.refresh();
    } catch (e2) {
      alert(e2.message);
    } finally {
      setBusy(false);
    }
  }

  /* Worked out once per render, not per post — otherwise every card would
     scan the whole list to answer the same question. */
  const lonelyId = loneliest(posts);

  return (
    <>
      {/* ---- WELCOME HOME ----
          The first thing on the page, every time. It's warm on purpose:
          the moment somebody opens this app is often not a good moment,
          and the first thing they read should be a chair being pulled
          out rather than a metric.

          ⚠️ Worth revisiting once there are real members. "You made it"
          is lovely the first week and can land badly on a bad day in
          month six. The honest fix later is to retire it after a while
          or save it for milestone days — but that's a decision to make
          with real people in here, not a guess made now. */}
      <div className="home">
        <span className="blob" aria-hidden="true" />
        <h2>Welcome home{me.name ? ', ' + me.name : ''}.</h2>
        <p>You made it. Pull up a chair.</p>
      </div>

      {/* ---- THE MILESTONE OFFER ----

          A CARD, NOT A MODAL. A modal on the morning you hit 90 days is
          the app demanding a response before it will let you in. This can
          be scrolled straight past, and scrolling past is a valid answer
          — it just gets asked once more next time, because scrolling is
          not the same as saying no.

          ⚠️ THE ONLY THING THIS MAY EVER SAY IS CONGRATULATIONS.
          The same arithmetic that knows somebody hit 90 days today knows
          when somebody who was at 88 is suddenly at 3. The app must never
          mention that. No "sorry to see it", no "start again", no gentle
          little note. The relapse is already the loudest thing in that
          person's life and this app's entire job that day is to be the
          one place that doesn't bring it up. The lifetime total is the
          only comment we make, and it's made without words. */}
      {offer && (
        <div className="mstone">
          <span className="mstone-coin" aria-hidden="true">🪙</span>
          <div className="mstone-body">
            <h3>You hit {offer.full} today.</h3>
            <p>Want to put it on the wall?</p>
          </div>
          <div className="mstone-acts">
            <button type="button" className="btn" disabled={busy}
                    onClick={() => answerMilestone(true)}>Share it</button>
            <button type="button" className="btn ghost" disabled={busy}
                    onClick={() => answerMilestone(false)}>Not this time</button>
          </div>
        </div>
      )}

      {/* ---- THE COMPOSER, MOVED TO THE TOP ----
          It used to sit under the wall. Two reasons it belongs here:

          1. On a phone you land at the top, and the thing this app most
             needs people to do is post. A composer you have to scroll
             past everyone else's words to reach is a composer that asks
             you to lose your nerve first.
          2. The anonymous switch now lives INSIDE it, on the line that
             says who you're posting as. That used to be a separate
             floating toggle, which meant the most consequential choice
             on the screen was made somewhere other than where you were
             typing. Decide how brave you're being at the moment you're
             being it. */}
      <form className="composer" onSubmit={post}>
        <div className="ctop">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={5000}
                 aria-label="Write something for the wall"
                 placeholder={anon ? 'Nobody will see who wrote this…'
                                   : 'Share something with people who get it…'} />
          {/* ⚠️ NOT DISABLED WHEN ANONYMOUS — ABSENT.

              The old comment here said a control that does nothing is
              worse than a missing one. That still holds, and it applies
              just as much to a greyed-out camera: a disabled button is an
              invitation to work out how to enable it, and the answer
              would be "stop being anonymous". Nobody should be nudged
              toward that trade by a piece of chrome. When you're
              anonymous the camera simply isn't part of the composer, and
              one plain line below says why. */}
          {!anon && (
            <PhotoUpload kind="post" disabled={busy} className="camera"
                         label={photo ? '✓' : '📷'}
                         onDone={(path, preview) => {
                           setPhoto({ path, preview });
                           setFreshUrls((u) => ({ ...u, [path]: preview }));
                         }} />
          )}
          <button type="submit" className="send" disabled={busy || !text.trim()}>
            {busy ? '…' : 'Post'}
          </button>
        </div>

        {photo && (
          <div className="cphoto">
            <img src={photo.preview} alt="The photo you're about to post" />
            <button type="button" className="cphoto-x" aria-label="Take the photo off"
                    disabled={busy} onClick={() => setPhoto(null)}>×</button>
          </div>
        )}

        <div className="cas">
          <span>Posting as</span>
          <button type="button" className={'asme' + (anon ? ' anon' : '')}
                  aria-pressed={anon}
                  onClick={toggleAnon}>
            {anon ? '🤫 anonymous' : '🌱 ' + (me.name || 'you')}
          </button>
          <span className="cas-hint">
            {anon ? 'tap to use your name' : 'tap to post anonymously'}
          </span>
        </div>

        {/* The explanation, and only when it's relevant. A permanent note
            about anonymous photo rules on a composer nobody is using
            anonymously is noise; the same sentence at the moment it
            applies is an answer. */}
        {anon && (
          <p className="canon-note">
            {photoDropped
              ? 'Photo taken off — anonymous posts are words only. A face in a mirror or a street sign through a window is the quickest way to stop being anonymous by accident.'
              : 'Anonymous posts are words only.'}
          </p>
        )}
      </form>

      <div className="wall">
        {posts.length === 0 && (
          <div className="empty">
            <div className="h">Nothing on the wall yet.</div>
            <div className="p">
              Put something up. Nobody posts into silence here —<br />
              whatever you write, someone answers.
            </div>
          </div>
        )}

        {/* DOM order is reading order: newest first. Position is CSS only. */}
        {posts.map((p, i) => {
          const w = weight(p, p.id === lonelyId);
          return (
            <article
              key={p.id}
              className={
                'item ' + w +
                (p.is_anonymous ? ' screened' : '') +
                (i === 0 ? ' newest' : '')
              }
            >
              {/* NAME AND FACE ON ONE ROW.

                  `display_avatar` comes out of the view nulled on exactly
                  the same condition as the handle, so an anonymous post
                  physically cannot carry its author's real face — there's
                  nothing here to leak. The 🤫 is the fallback, and it's
                  the fallback because the column is empty, not because
                  the markup chose to hide something. */}
              <div className="hd">
                {/* Three conditions had to be true in the view before a
                    real face reaches this line — not anonymous post, not
                    anonymous profile, and the member actually chose the
                    photo option. All three live in feed_posts, so there is
                    nothing for this markup to decide. It renders whatever
                    it was given, and what it was given is already safe. */}
                {!p.is_anonymous && urlFor(p.display_avatar_photo) ? (
                  <img className="pa pa-photo" src={urlFor(p.display_avatar_photo)}
                       alt="" aria-hidden="true" />
                ) : (
                  <span className="pa" aria-hidden="true">
                    {p.is_anonymous ? '🤫' : (p.display_avatar || '🌱')}
                  </span>
                )}
                <span className="hw">
                  <span className="nm">
                    {who(p)}
                    {p.milestone_days ? (
                      <span className="mbadge">🪙 {p.milestone_days} days</span>
                    ) : null}
                  </span>
                  <span className="mt">
                    {ago(p.created_at)}
                    {p.is_anonymous ? ' · anonymous' : ''}
                  </span>
                </span>
              </div>

              {/* The rule, explained at the one moment it's visible.

                  ⚠️ NEVER on your own post. You'd be reading "nobody
                  answered you" in 26px about the thing you just worked up
                  the nerve to share. The post still grows for everyone else
                  — that's the point — you just don't get told why. */}
              {w === 'poster' && unanswered(p) && !p.is_mine && (
                <div className="waiting">
                  Nobody&apos;s answered this one yet
                </div>
              )}

              <p className="bd">{p.body}</p>

              {/* ⚠️ `p.photo_url` is null on every anonymous post because
                  feed_posts nulls it — this does not need, and must not
                  grow, its own `!p.is_anonymous` check. A second copy of
                  the rule here would be a second place to forget to
                  update, and the copy that goes stale is always the one
                  nobody is reading.

                  alt="" is correct rather than lazy: a photo somebody
                  attached to a post has no description we can honestly
                  give, and inventing one for a screen reader is worse
                  than admitting the picture is decorative to the text. */}
              {p.photo_url && urlFor(p.photo_url) && (
                <div className="pphoto">
                  <img src={urlFor(p.photo_url)} alt="" loading="lazy" />
                </div>
              )}

              {/* THE CHIP — the only gold in the app.

                  It's the actual object: the thing people carry in a
                  pocket and turn over with a thumb. Nobody has ever
                  screenshotted a progress bar; people have photographed
                  that coin on a kitchen table for seventy years.

                  ⚠️ This renders ONLY when milestone_days is set, and
                  nothing sets it yet — sharing a milestone is a deliberate
                  tap that hasn't been built. Which means: gold appears on
                  this wall only because somebody chose to put it there.
                  Never because the app noticed a date and announced it. */}
              {p.milestone_days ? (
                <div className="chipcard">
                  <span className="coin" aria-hidden="true">🦅</span>
                  <span className="chiplbl">{p.milestone_days}-day chip</span>
                </div>
              ) : null}

              <div className="ft">
                {/* aria-pressed is what tells a screen reader this is a
                    toggle that's currently on, rather than just a button. */}
                <button
                  className={'heart' + (p.liked_by_me ? ' on' : '')}
                  aria-pressed={!!p.liked_by_me}
                  aria-label={p.liked_by_me ? 'Undo like' : 'Like this'}
                  onClick={() => like(p)}
                >
                  {p.liked_by_me ? '♥' : '♡'} {p.like_count}
                </button>
                {/* The reply count is the tap target. Deliberately worded as
                    an invitation when it's zero — that's the post that most
                    needs someone, and it's the one already sized biggest. */}
                <button className="replies" onClick={() => setOpen(p)}>
                  {p.comment_count === 0
                    ? 'say something'
                    : p.comment_count + (p.comment_count === 1 ? ' reply' : ' replies')}
                </button>
                {/* is_mine, never author_id — an anonymous post still shows
                    the author their own controls without exposing them */}
                {p.is_mine
                  ? <span className="mine">yours</span>
                  : (
                    /* No ⋯ on your own post: there is nobody to report or
                       block but yourself, and offering it would be noise. */
                    <button className="dots" aria-label="Report or block"
                            onClick={() => setMenu(p)}>⋯</button>
                  )}
              </div>
            </article>
          );
        })}
      </div>

      {/* The composer and the anonymous toggle used to live down here.
          Both moved to the top of the page — see the note up there. */}

      {open && (
        <Thread
          post={open}
          onClose={() => setOpen(null)}
          onCountChange={refresh}
        />
      )}

      {menu && (
        <PostMenu
          post={menu}
          onClose={() => setMenu(null)}
          onBlocked={refresh}
        />
      )}
    </>
  );
}
