'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import Thread from './Thread';
import PostMenu from './PostMenu';

/* Deterministic rotation from the post id.
   Random angles look fine in a screenshot and are unusable in practice —
   the whole wall reshuffles on every render. Seeding from the id means a
   given scrap always sits at the same angle. */
function rot(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const deg = ((Math.abs(h) % 400) / 100) - 2;   // −2.00° … +1.99°
  return deg.toFixed(2) + 'deg';
}

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

/* The sizing rule from the spec. Deliberately dumb and legible.
   The second clause is the important one: an unanswered post gets BIGGER. */
function weight(p) {
  const old = Date.now() - new Date(p.created_at).getTime() > TWO_HOURS;
  if (p.milestone_days) return 'poster';
  if (p.comment_count === 0 && old) return 'poster';
  if (p.comment_count > 0) return 'card';
  return p.body.length < 90 ? 'scrap' : 'card';
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

  // Re-read the wall so the reply count (and therefore the scrap's SIZE)
  // updates. Worth noting: answering a post can shrink it — an unanswered
  // post is a poster, an answered one is a card. The layout is the promise.
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
          const w = weight(p);
          return (
            <article
              key={p.id}
              className={
                'item ' + w +
                (p.is_anonymous ? ' screened' : '') +
                (i === 0 ? ' newest' : '')
              }
              style={{ '--rot': rot(p.id) }}
            >
              {w === 'poster' ? <span className="tape" /> : <span className="pin" />}

              <div className="nm">
                {p.milestone_days ? `🏅 ${p.milestone_days} DAYS` : p.display_name}
              </div>
              <div className="mt">
                {p.milestone_days ? p.display_name + ' · ' : ''}{ago(p.created_at)}
                {p.is_anonymous ? ' · anonymous' : ''}
              </div>

              {/* The rule, explained at the one moment it's visible.

                  ⚠️ NEVER on your own post. You'd be reading "nobody
                  answered you" in 26px about the thing you just worked up
                  the nerve to share. The post still grows for everyone else
                  — that's the point — you just don't get told why. */}
              {w === 'poster' && unanswered(p) && !p.is_mine && (
                <div className="waiting">
                  ↑ big because nobody&apos;s answered it yet
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
