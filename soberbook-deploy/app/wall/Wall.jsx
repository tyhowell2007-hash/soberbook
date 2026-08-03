'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

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

/* The sizing rule from the spec. Deliberately dumb and legible.
   The second clause is the important one: an unanswered post gets BIGGER. */
function weight(p) {
  const twoHours = 2 * 60 * 60 * 1000;
  const old = Date.now() - new Date(p.created_at).getTime() > twoHours;
  if (p.milestone_days) return 'poster';
  if (p.comment_count === 0 && old) return 'poster';
  if (p.comment_count > 0) return 'card';
  return p.body.length < 90 ? 'scrap' : 'card';
}

export default function Wall({ initial }) {
  const router = useRouter();
  const supabase = browserClient();
  const [posts, setPosts] = useState(initial);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);

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

              <p className="bd">{p.body}</p>

              <div className="ft">
                <span>♥ {p.like_count}</span>
                <span>{p.comment_count === 0 ? 'no replies yet' : p.comment_count + ' replies'}</span>
                {/* is_mine, never author_id — an anonymous post still shows
                    the author their own controls without exposing them */}
                {p.is_mine && <span className="mine">yours</span>}
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
    </>
  );
}
