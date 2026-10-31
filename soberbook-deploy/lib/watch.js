/* =====================================================================
   SEEN AND WATCHED — the browser side.  31 Oct 2026 (0196).

   ⭐ ONLY NUMBERS EVER COME BACK OUT. These calls write "this member saw /
   watched this post" into post_views, a table no member can read. The
   wall gets a count; the author gets a count and a curve; nobody, ever,
   gets a name.

   🔴 SEEN: a text or photo post counts once it has sat at least half on
   screen for 1.5 seconds. Flicking past does not count. Each post is sent
   at most once per page load, in small batches, so a long scroll is a
   handful of requests, not hundreds.

   🔴 WATCHED: a video counts once 3 seconds have actually played. The
   furthest point reached is reported every few seconds and on pause/end,
   which is what draws the "where people stopped" curve for the author.

   ⚠️ Every call is fire-and-forget. A count failing to land must never
   break the wall, so errors are swallowed on purpose — this is the one
   place in the app where that is the right choice.
   ===================================================================== */

const sent = new Set();
let queue = [];
let timer = null;

function flush(supabase) {
  timer = null;
  if (!queue.length) return;
  const ids = queue.splice(0, 60);
  supabase.rpc('mark_seen', { p_posts: ids }).then(() => {}, () => {});
  if (queue.length) timer = setTimeout(() => flush(supabase), 1500);
}

export function queueSeen(supabase, id) {
  if (!id || sent.has(id)) return;
  sent.add(id);
  queue.push(id);
  if (!timer) timer = setTimeout(() => flush(supabase), 3000);
}

export function flushSeen(supabase) {
  if (timer) { clearTimeout(timer); timer = null; }
  flush(supabase);
}

/* Watches every element on the page carrying data-seen-id. Returns a
   cleanup function. Call again when the list of posts changes. */
export function observeSeen(supabase, root = document) {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const timers = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = e.target.getAttribute('data-seen-id');
      if (!id || sent.has(id)) continue;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        if (!timers.has(id)) {
          timers.set(id, setTimeout(() => { timers.delete(id); queueSeen(supabase, id); }, 1500));
        }
      } else if (timers.has(id)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
      }
    }
  }, { threshold: [0, 0.5, 1] });
  root.querySelectorAll('[data-seen-id]').forEach((el) => {
    if (!sent.has(el.getAttribute('data-seen-id'))) io.observe(el);
  });
  const onHide = () => { if (document.visibilityState === 'hidden') flushSeen(supabase); };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    io.disconnect();
    timers.forEach((t) => clearTimeout(t));
    document.removeEventListener('visibilitychange', onHide);
  };
}

/* A watcher for one video on one post. Feed it the player's current time
   and duration from play / timeupdate / pause / ended events. */
export function makeWatcher(supabase, postId) {
  let newPlay = false;
  let lastSent = -1;
  let lastAt = 0;
  const send = (t, d) => {
    lastSent = t; lastAt = Date.now();
    supabase.rpc('mark_watched', {
      p_post: postId, p_seconds: Math.round(t * 10) / 10,
      p_duration: d && isFinite(d) ? Math.round(d * 10) / 10 : null,
      p_new_play: newPlay,
    }).then(() => {}, () => {});
    newPlay = false;
  };
  return {
    play() { newPlay = true; },
    progress(t, d) {
      if (!postId || !(t >= 3)) return;              // nothing counts before 3s
      if (newPlay || t - lastSent >= 5 || Date.now() - lastAt > 8000) send(t, d);
    },
    stop(t, d) {
      if (!postId || !(t >= 3) || t <= lastSent) return;
      send(t, d);
    },
  };
}

/* One watcher per post for the life of the page — the wall re-renders
   constantly, and a fresh watcher each render would forget it had already
   reported the play. */
const watchers = new Map();
export function watcherFor(supabase, postId) {
  if (!watchers.has(postId)) watchers.set(postId, makeWatcher(supabase, postId));
  return watchers.get(postId);
}

/* Event handlers for a plain <video>. */
export function videoHandlers(supabase, postId, mine) {
  if (mine || !postId) return {};
  const w = watcherFor(supabase, postId);
  return {
    onPlay: () => w.play(),
    onTimeUpdate: (e) => w.progress(e.currentTarget.currentTime, e.currentTarget.duration),
    onPause: (e) => w.stop(e.currentTarget.currentTime, e.currentTarget.duration),
    onEnded: (e) => w.stop(e.currentTarget.currentTime, e.currentTarget.duration),
  };
}
