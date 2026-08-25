/* =====================================================================
   MIXING SOMETHING TO WATCH IN WITH WHAT PEOPLE WROTE.

   Ty, Aug 23: "people are gonna need something more than just looking at
   themselves… mix with other users posts."

   ---------------------------------------------------------------------
   🔴 THE RULE THAT PROTECTS THE ONLY THING THIS APP HAS.

   The wall's mechanic is that an unanswered post gets BIGGER so somebody
   answers it. "Nobody posts into silence here" is the whole product. A
   funny video is always easier than answering a person who said they had
   a rough night, so every card added to this page competes with that.

   Ty was told this and chose the mixed feed anyway — his call. So the
   promise is protected here instead, by three rules:

     1. NEVER directly above the promoted post. The one post the wall has
        singled out for being ignored must not have a video sitting on top
        of it. That is the exact moment the mechanic is doing its job.
     2. A FIXED RATIO. One card per EVERY posts, always. ⚠️ It must not be
        a filler that expands when the wall is quiet — a thin day would
        turn into a video feed with a few posts in it, which is a
        different product.
     3. NEVER TWO IN A ROW. Follows from the ratio, asserted anyway,
        because the day somebody changes EVERY to 1 is the day this
        silently becomes YouTube.

   ---------------------------------------------------------------------
   ⭐ AND ONE RULE ABOUT FAIRNESS BETWEEN SOURCES, FOUND BY LOOKING AT
   REAL DATA RATHER THAN BY THINKING.

   The first pull put FIVE near-identical Drumeo shorts in the top sixteen
   items, because Drumeo posts constantly and the others post weekly.
   Straight chronological order hands the wall to whoever uploads most.

   So content is ROUND-ROBINED across sources: newest from Dopey, then
   newest from GITT Up, then Drumeo, and so on, before anybody gets a
   second turn. Every source keeps its own recency order; nobody floods.

   ⚠️ This is not "an algorithm" in the sense the rest of this app
   refuses. It ranks nothing by engagement, it knows nothing about the
   reader, and it produces the same order for every member. It is a
   turn-taking rule, and the whole of it is below in twelve lines.
   ===================================================================== */

export const EVERY = 4;      // one card per this many posts

/* ⚠️ THE CAP, AND IT WAS FOUND BY A TEST FAILING RATHER THAN BY DESIGN.
   Round-robin alone breaks up the flood at the TOP and then rebuilds it at
   the bottom: once the weekly channels run out of turns, the only queue
   with anything left is the one that uploads twelve times a week, and the
   tail becomes solid Drumeo again.

   Taking at most this many from each source means the queues stay roughly
   even and can always alternate. With seven sources that is 21 candidates
   for a wall that will place about eight — plenty of slack, and variety
   by construction rather than by luck. */
export const MAX_PER_SOURCE = 3;

/* Round-robin by source, newest first within each. */
export function fairOrder(items = []) {
  const bySource = new Map();
  for (const it of [...items].sort(
    (a, b) => new Date(b.published_at) - new Date(a.published_at)
  )) {
    const k = it.source_label || '?';
    if (!bySource.has(k)) bySource.set(k, []);
    const q = bySource.get(k);
    if (q.length < MAX_PER_SOURCE) q.push(it);
  }
  const queues = [...bySource.values()];
  const out = [];
  let live = true;
  while (live) {
    live = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) { out.push(next); live = true; }
    }
  }
  return out;
}

/* =====================================================================
   Returns a single list of { type:'post', post } and { type:'content',
   item } for the wall to render in order.

   ⚠️ `lonelyId` is the post the wall has promoted for being unanswered.
   It is passed in rather than recomputed, because the wall already works
   it out to decide sizing — computing it twice is two implementations of
   one rule, and the second one drifts. (0046 → 0049, three times now.)
   ===================================================================== */
/* =====================================================================
   PINNED TO THE TOP (0072).

   Ty, Aug 25: "everything i give you to post, make sure it starts at the
   beginning of the feed. it still not working."

   ⭐ HE WAS RIGHT AND IT WASN'T A BUG. The OCAAR card rendered perfectly
   — at article 4, 1,524 pixels down. Three screens on a phone. It existed
   and he had never seen it, and from where he sits those are the same
   thing. The lesson is older than this file: something built with no way
   to reach it is not built.

   ---------------------------------------------------------------------
   🔴 THE PIN DOES NOT GET TO BREAK RULE 1.

   Rule 1 says a card never sits directly above the post the wall has
   promoted for being unanswered, because that is the exact moment the
   only mechanic this app has is doing its job. A pin is a card that goes
   ABOVE EVERYTHING, so if the promoted post happens to be first, the pin
   would land on top of it — rule 1 broken by a feature that never
   mentions rule 1.

   So the pin slides to second place in that one case. One line, below.

   ⚠️ AND THE PIN IS OUTSIDE THE RATIO. It doesn't consume a rotation
   slot and doesn't reset the counter, because it isn't part of the
   turn-taking — it's one thing Ty put there on purpose. If it counted,
   posting a flyer would silently delete one YouTube card from the wall.

   🔴 AT MOST ONE, EVER. Newest pin wins; anything else that is pinned
   falls back into ordinary rotation rather than vanishing. A stack of
   pinned org notices at the top of a recovery feed is a noticeboard, and
   this is not a noticeboard.
   ===================================================================== */
export function pickPin(content = []) {
  const pinned = content.filter((c) => c.pinned_at);
  if (!pinned.length) return null;
  return pinned.reduce((newest, c) =>
    new Date(c.pinned_at) > new Date(newest.pinned_at) ? c : newest
  );
}

export function mixFeed(posts = [], content = [], { every = EVERY, lonelyId = null } = {}) {
  /* Taken out of the pool first so it can't also appear further down. */
  const pin = pickPin(content);
  content = pin ? content.filter((c) => c.id !== pin.id) : content;

  const queue = fairOrder(content);
  const out = [];
  let sincePost = 0;

  /* 🔴 Rule 1, applied to the pin. If the very first post is the one
     waiting to be answered, the pin waits one place. Everywhere else it
     is genuinely first. */
  const pinGoesFirst = pin && !(posts[0] && posts[0].id === lonelyId);
  if (pinGoesFirst) out.push({ type: 'content', item: pin, pinned: true });

  for (let i = 0; i < posts.length; i++) {
    out.push({ type: 'post', post: posts[i] });
    /* The displaced pin, placed after the promoted post rather than on
       top of it. ⚠️ Also guarded so it can't land on a second post if the
       wall is somehow empty above. */
    if (pin && !pinGoesFirst && i === 0) {
      out.push({ type: 'content', item: pin, pinned: true });
    }
    sincePost++;

    if (sincePost < every || !queue.length) continue;

    /* RULE 1 — not directly above the post that is waiting to be
       answered. Hold the card and place it after that post instead. */
    const next = posts[i + 1];
    if (next && next.id === lonelyId) continue;

    /* RULE 3 — belt and braces. If the previous entry is already a card,
       don't add another, whatever the ratio says. */
    if (out[out.length - 1]?.type === 'content') continue;

    out.push({ type: 'content', item: queue.shift() });
    sincePost = 0;
  }

  /* ⚠️ Anything left in the queue is DROPPED, deliberately. The
     alternative — tipping the remainder onto the end — turns the bottom
     of a quiet wall into a wall of videos, which is rule 2 broken by the
     back door. A short wall shows fewer cards. That's correct. */
  return out;
}
