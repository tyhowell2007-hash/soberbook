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

/* =====================================================================
   🎉 THE CELEBRATION RIDES AT THE TOP.

   Ty, 16 Sept: "I want this to come up automatically every time somebody is
   celebrating a milestone in their life. I don't want to be the one
   presenting it. It comes up by itself."

   ⭐ THE PROBLEM IT SOLVES, MEASURED: Kenny's six-year post was FORTY-EIGHT
   POSTS DOWN the wall by the time anybody looked. The celebration had been
   built, it rendered perfectly, and it was three screens past where anyone
   scrolls — which is the oldest failure in this project wearing a party hat.
   A milestone is the one post with an expiry date on its meaning: answering
   it a week late is not the same act.

   🔴 IT IS NOT A PIN AND MUST NEVER BECOME ONE. A pin is Ty choosing that an
   organisation should be seen. This is the app noticing a PERSON, and the
   only thing that puts it here is that the member tapped "Share it" on their
   own milestone. There is no hand-set column, no admin screen, and nothing
   Ty has to do — that is the whole request.

   🔴 THERE IS NO EXPIRY, AND THAT IS TY'S CALL, MADE 16 SEPT WITH THE COST
   IN FRONT OF HIM: "we're going to leave those cards up there because I think
   it's a great way to start a conversation and to celebrate something very
   important… anytime somebody hits a milestone, we have to celebrate this
   exact way."

   ⚠️ THIS REPLACES A 24-HOUR WINDOW, AND THE OLD NUMBER WAS WRONG ON
   ARITHMETIC, NOT PRINCIPLE. It was written from the worry that a card still
   at the top on Thursday is furniture — true in an app where milestones
   arrive daily. They do not. TWO milestone posts exist in this app's entire
   life, six weeks apart, because the offer only fires if you happen to open
   the app on the exact day (see 0161). At that rate a 24-hour window put a
   medal on the wall roughly one day in nine, and almost every member would
   have gone their whole time here without once seeing that this exists.

   ⭐ SO THE CAP IS NOW THE ONLY LIMIT, AND IT IS DOING ALL THE WORK. With no
   expiry the top of the wall carries the three most recent milestones, and
   they turn over as new ones land rather than on a clock. Nothing is ever
   hand-placed and nothing is ever taken down by a person — the same rule
   that put a card up is the only thing that moves it.

   🔴 THE COST, RECORDED SO NOBODY THINKS IT WAS MISSED: three cards is real
   estate, roughly two phone screens of gold before the first human sentence
   on a full day. Rule 1 below still protects the unanswered post, so nobody
   scrolls past a party to find out nobody answered them — but if the wall
   ever feels top-heavy, MAX_CELEBRATIONS is the number to move, not the
   expiry. Putting a clock back on it takes the feature back to invisible.

   ⚠️ THREE AT MOST, NEWEST FIRST — and that number is measured, not picked.
   Across the next twelve weeks there are 86 milestones, about 7 a week, and
   23 days carry two or more; 25 October carries FIVE. On a five-milestone
   day an uncapped rule would open the wall with five medals and push every
   human sentence below the fold.

   🔴 THE ONES OVER THE CAP ARE NOT DROPPED — they stay in the feed in their
   ordinary chronological place, because they are posts somebody wrote, not
   cards the feed chose. Nothing disappears; it just doesn't float.

   🔴 AND THE FEED WINDOW IS WHAT MAKES "no expiry" A LIE IF NOBODY GUARDS IT.
   `app/wall/page.jsx` reads the newest 60 posts. A milestone that falls off
   the bottom of that window cannot be floated by this function, because it
   is not in the array — so the card would go dark on a timer nobody set,
   which is the 3 Sept pin bug. page.jsx fetches milestone posts in their own
   query for exactly this reason. If that second query is ever "tidied away",
   this comment is the thing that was true and stopped being true. */
export const MAX_CELEBRATIONS = 3;

export function pickCelebrations(posts = []) {
  return posts
    .filter((p) => p.milestone_days)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, MAX_CELEBRATIONS);
}

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

   ⚠️ ALL OF THEM, NEWEST FIRST — changed Aug 26 on Ty's instruction:
   "all ads start at the begging of the home feed."

   This used to be AT MOST ONE, on the argument that a stack of pinned org
   notices turns a recovery feed into a noticeboard. That argument is still
   true and is why nothing pins itself: `pinned_at` is set by hand, by Ty,
   one row at a time. There is no code path anywhere that pins something
   automatically, so the stack can only ever be as tall as he made it.

   🔴 The thing to watch is not the rule, it's the number. Two is a lead;
   six is a wall of adverts a member has to scroll past to reach the person
   who posted at 3am. If this ever gets long, the fix is unpinning old ones,
   not re-capping it here — a cap would silently drop whichever ad Ty
   pinned most recently and he'd have no way to see why.
   ===================================================================== */
export function pickPins(content = []) {
  return content
    .filter((c) => c.pinned_at)
    .sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));
}

/* Kept so nothing that imported the old name breaks. ⚠️ It returns the
   FIRST of the list, which is the newest — same answer the old function
   gave, rather than a subtly different one. */
export function pickPin(content = []) {
  return pickPins(content)[0] || null;
}

export function mixFeed(posts = [], content = [], { every = EVERY, lonelyId = null } = {}) {
  /* 🎉 THE CELEBRATIONS COME OUT OF THE POST STREAM FIRST.

     ⚠️ Removed, not copied. Leaving them in place would put the same medal
     at the top of the wall and again forty posts down — the reader's own
     eyes would call that a bug, and they would be right.

     ⚠️ They are placed ABOVE the lead pin. A pin is an advert somebody paid
     attention to; this is a person. If the two ever compete for the opening
     slot the person wins, and that ordering is not an accident of where
     these lines sit. */
  const celebrations = pickCelebrations(posts);
  if (celebrations.length) {
    const celebIds = new Set(celebrations.map((p) => p.id));
    posts = posts.filter((p) => !celebIds.has(p.id));
  }

  /* 📌 AN AD IS A POST NOW, SO IT CAN BE HEARTED AND REPLIED TO — 16 Sept.
     Ty, three times: "I want people to be able to like it and comment on
     them."

     ⭐ NOTHING ABOUT WHERE ADS SIT CHANGES. The pin placement below is
     untouched: newest opens the feed, the rest are spread one every four
     posts, rule 1 still holds them back off the unanswered post. All that
     changes is what gets EMITTED at those positions — a post row carrying
     the poster, instead of a bare card. The post brings hearts, replies,
     reporting and the ⋯ menu with it for free, which is the whole reason
     an ad was made a post rather than growing a second likes table
     (0164, and the drop pattern from 0058 before it).

     🔴 THEY ARE PULLED OUT OF THE POST STREAM FIRST, exactly like the
     celebrations above. An ad post is a real row in `posts`, so without
     this it would render twice — once in its pinned position and again in
     its chronological place — and the reader would rightly call that a
     bug. Removed, never copied. */
  const adByItem = new Map();
  for (const p of posts) if (p.content_item_id) adByItem.set(p.content_item_id, p);
  if (adByItem.size) posts = posts.filter((p) => !p.content_item_id);

  /* An ad row is a POST row that happens to carry an item. Everything that
     used to ask `type === 'content'` has to keep treating it as a card —
     see isCard() below — or rule 3 stops seeing ads and starts stacking
     two adverts together. */
  const pinRow = (item, pinned = true) => {
    const ad = adByItem.get(item.id);
    return ad
      ? { type: 'post', post: ad, item, pinned }
      : { type: 'content', item, pinned };
  };
  /* ⚠️ `row.item` is the tell, not `row.type`. A post row with an item on it
     is an advert and counts as a card for spacing; an ordinary post is not. */
  const isCard = (row) => !!row && (row.type === 'content' || !!row.item);

  /* Taken out of the pool first so they can't also appear further down. */
  const pins = pickPins(content);
  const pinIds = new Set(pins.map((p) => p.id));
  content = pins.length ? content.filter((c) => !pinIds.has(c.id)) : content;

  const queue = fairOrder(content);
  const out = [];
  let sincePost = 0;

  /* 🔴 Rule 1, applied to the lead pin. If the very first post is the one
     waiting to be answered, the pin waits one place and sits under it.

     ⚠️ This note used to say "the whole stack waits together, because
     splitting them would put one ad above the promoted post and the rest
     below it, which reads as a bug." That stopped being true the moment
     the pins were spread out — there is no stack any more, and the rest
     are placed by the loop below, which applies rule 1 for itself. */
  /* ⭐ ONE PIN OPENS THE FEED. THE REST ARE SPREAD THROUGH IT — 3 Sept.

     Ty, looking at four org posters stacked at the top: "we should space
     them out a little bit better… like in between posts."

     🔴 THE COMMENT ABOVE PREDICTED THIS AND NAMED THE NUMBER: "Two is a
     lead; six is a wall of adverts a member has to scroll past to reach
     the person who posted at 3am." Four was enough to feel it. What that
     note got wrong was the remedy — it said the fix would be unpinning
     old ones. It isn't. Every one of these organisations belongs on the
     wall; they just don't belong in a single block.

     ⚠️ THIS REVERSES HALF OF AN INSTRUCTION, DELIBERATELY AND ONLY HALF.
     On 26 Aug Ty said "all ads start at the begging of the home feed",
     which is why they were all hoisted. The newest pin still opens the
     feed — ads still start at the beginning — but the others now take
     their turn further down instead of queueing behind it.

     ⚠️ Newest first is unchanged: pickPins() already sorts by pinned_at
     descending, so the one Ty pinned most recently is the one that opens
     the wall, and the older ones fall through the feed in order. */
  /* 🔴 RULE 1 APPLIES TO THE CELEBRATION TOO, AND IT WAS THE HARDEST CALL
     IN THIS FILE.

     Rule 1 says nothing sits directly above the post the wall has promoted
     for going unanswered. A medal is the most cheerful thing this app can
     draw, and dropping it on top of somebody who wrote at 3am and got no
     reply is the exact moment the only mechanic this app has is working —
     so the celebration waits one place, the same way the pin does.

     ⭐ It costs the celebrant almost nothing: second on the wall instead of
     first. It saves the other person from scrolling past a party to find
     out nobody answered them. That trade is not close. */
  const celebsGoFirst =
    celebrations.length && !(posts[0] && posts[0].id === lonelyId);
  if (celebsGoFirst) {
    for (const c of celebrations) out.push({ type: 'post', post: c, celebrated: true });
  }

  const [leadPin, ...restPins] = pins;
  const pinsGoFirst = pins.length && !(posts[0] && posts[0].id === lonelyId);
  if (pinsGoFirst) {
    out.push(pinRow(leadPin));
  }

  /* How many posts between the remaining pins. ⚠️ Deliberately WIDER than
     the content-card ratio: a YouTube clip is something to watch, an org
     poster is an advert, and the wall can carry more of the former than
     the latter before it stops feeling like people talking. */
  const PIN_EVERY = 4;
  const pinQueue = [...restPins];
  let sincePin = 0;

  for (let i = 0; i < posts.length; i++) {
    out.push({ type: 'post', post: posts[i] });
    /* 🎉 The displaced celebration, placed after the promoted post rather
       than on top of it — and still ahead of the displaced pin, so the
       person/advert ordering survives being bumped. */
    if (celebrations.length && !celebsGoFirst && i === 0) {
      for (const c of celebrations) out.push({ type: 'post', post: c, celebrated: true });
    }

    /* The displaced stack, placed after the promoted post rather than on
       top of it. ⚠️ Also guarded so it can't land on a second post if the
       wall is somehow empty above. */
    if (pins.length && !pinsGoFirst && i === 0) {
      out.push(pinRow(leadPin));
    }
    sincePost++;
    sincePin++;

    /* ⭐ THE REST OF THE PINS, ONE AT A TIME, FURTHER DOWN.

       ⚠️ It obeys the same two rules the content cards obey, because a
       poster is more of an advert than a clip is and has less licence,
       not more:
         RULE 1 — never directly above the post waiting to be answered.
         RULE 3 — never straight after another card.
       Without those, spacing the pins out would just move the pile-up
       somewhere less visible. */
    if (pinQueue.length && sincePin >= PIN_EVERY) {
      const next = posts[i + 1];
      if (!(next && next.id === lonelyId) && !isCard(out[out.length - 1])) {
        out.push(pinRow(pinQueue.shift()));
        sincePin = 0;
      }
    }

    if (sincePost < every || !queue.length) continue;

    /* RULE 1 — not directly above the post that is waiting to be
       answered. Hold the card and place it after that post instead. */
    const next = posts[i + 1];
    if (next && next.id === lonelyId) continue;

    /* RULE 3 — belt and braces. If the previous entry is already a card,
       don't add another, whatever the ratio says. */
    if (isCard(out[out.length - 1])) continue;

    out.push({ type: 'content', item: queue.shift() });
    sincePost = 0;
  }

  /* ⚠️ Anything left in the queue is DROPPED, deliberately. The
     alternative — tipping the remainder onto the end — turns the bottom
     of a quiet wall into a wall of videos, which is rule 2 broken by the
     back door. A short wall shows fewer cards. That's correct. */

  /* 🔴 BUT A PIN IS NOT A CARD, AND A LEFTOVER PIN IS NEVER DROPPED.

     The rule directly above is right about YouTube clips — the feed
     chooses those, so showing fewer is a smaller wall, not a mistake.
     Nothing chooses a pin. `pinned_at` is set by hand, by Ty, one row at
     a time, and the reason it exists is that he decided this particular
     organisation should be seen.

     ⚠️ So on a wall too short to space them all out, the remainder goes
     on the end rather than vanishing. That is the lesser of the two
     wrongs and the comment forty lines up says why: a pin that silently
     disappears gives him "no way to see why" — he'd be looking at a wall
     with an org missing and nothing anywhere saying it was dropped.

     ⚠️ Rule 3 is honoured on the join, so the flush can't butt straight
     onto a card, but it is NOT honoured between the flushed pins
     themselves. At that point the wall has run out of posts to separate
     them with, and the alternative is not showing them at all. */
  for (const p of pinQueue) out.push(pinRow(p));

  return out;
}
