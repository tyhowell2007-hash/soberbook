'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Thread from './Thread';
import PostMenu from './PostMenu';

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

export default function Wall({ initial }) {
  const router = useRouter();
  const supabase = browserClient();
  const [posts, setPosts] = useState(initial);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
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

  async function post(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('posts')
        .insert({ author_id: user.id, body, is_anonymous: anon });
      if (error) throw error;
      setText('');
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
              <div className="nm">
                {p.milestone_days ? `🏅 ${p.milestone_days} DAYS` : who(p)}
              </div>
              <div className="mt">
                {p.milestone_days ? <>{who(p)} · </> : null}{ago(p.created_at)}
                {p.is_anonymous ? ' · anonymous' : ''}
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

      <div className="anontoggle">
        <button type="button" className={anon ? 'on' : ''} aria-pressed={anon}
                onClick={() => setAnon(!anon)}>
          {anon ? '🤫 posting anonymously' : 'post anonymously?'}
        </button>
      </div>

      <form className="composer" onSubmit={post}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={5000}
               aria-label="Write something for the wall"
               placeholder={anon ? 'Nobody will see who wrote this…' : 'Put something up…'} />
        <button type="submit" disabled={busy || !text.trim()}>
          {busy ? '…' : 'Pin it'}
        </button>
      </form>

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
