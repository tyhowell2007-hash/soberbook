'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Thread from './Thread';
import PostMenu from './PostMenu';
import PhotoUpload from '../components/PhotoUpload';
import { Body, Player } from '../components/Linked';
import { fetchPreviews, PREVIEW_COUNT } from '../../lib/previews';
import { fetchDrops } from '../../lib/drops';
import { fetchTags, attachTags } from '../../lib/tags';
import { mixFeed } from '../../lib/mix';
import ContentCard from '../components/ContentCard';
import DropCard from '../components/DropCard';
import DropSheet from './DropSheet';

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
export default function Wall({ initial, me = { name: null, avatar: null, handle: null }, mark = null,
                               photoUrls = {}, previews = {}, tags: tags0 = {},
                               content = [], thumbBase = '',
                               drops = {}, dropUrls = {}, canHide = false }) {
  const router = useRouter();
  const supabase = browserClient();
  /* The milestone landing today, if there is one and it hasn't been
     answered. Server decides whether to send it; this only renders it. */
  const [offer, setOffer] = useState(mark);
  const [posts, setPosts] = useState(initial);
  /* The last couple of replies under each post, keyed by post id. Handed
     down from the server for first paint, then re-read here whenever the
     conversation actually changes. */
  const [convo, setConvo] = useState(previews);
  /* 🔴 The records, as STATE rather than a prop. As a prop it only moved
     when the whole server page re-rendered, which races with the client
     re-reading posts — so a record you just put out appeared as a post
     with no poster on it. That was the "it never showed up" bug. */
  const [recs, setRecs] = useState(drops);
  /* ⚠️ STATE, not a prop. The drops bug: a prop only refreshes when
     the whole server page re-renders, so a tag added a second ago
     wouldn't appear until a full reload. */
  const [tags, setTags] = useState(tags0);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  /* 'open' | 'friends'. Resets to open after every post — a sticky
     audience is how somebody posts to four people believing they
     posted to the room, or the reverse, which is worse. */
  const [audience, setAudience] = useState('open');

  /* ---- the photo OR video on the post being written (0022, 0029) ----
     { path, preview, isVideo } or null. `path` is what the database
     stores; `preview` is a local object URL so it appears the instant
     it's chosen rather than after a round trip.

     ⚠️ ONE piece of state, still — but now a LIST (0065).

     It used to be a single slot because `one_medium_per_post` meant a post
     carried a photo or a video and never both. Ty dropped that rule, so a
     post can now hold up to ten photos and a video together.

     ⭐ It stays ONE variable rather than becoming `photos` + `video`. The
     principle that made it one slot before still applies: the interface
     must not be able to offer a combination the database refuses, and the
     surest way to guarantee that is to have a single thing to reason
     about. The split into photo paths and a video path happens once, at
     the moment of posting, right next to the insert that cares. */
  const [media, setMedia] = useState([]);   // [{ path, preview, isVideo }]

  /* The caps, written once. ⚠️ MAX_PHOTOS must match photo_paths_ok() in
     0065 — the database refuses an eleventh, and a UI that lets somebody
     pick eleven is a UI that produces a constraint error at Post time,
     several minutes after the choice was made. */
  /* ---- tagging a friend (0067) ----

     ⭐ A LIST YOU PICK FROM, not a box you type a name into. The database
     refuses a tag on anyone who isn't a friend, so free text would mean
     somebody types a name, posts, and finds out afterwards it didn't
     take. Offering only the people who CAN be tagged means the refusal
     never has to happen.

     ⚠️ The picker is a convenience. The lock is mentions_guard() in the
     database — this list is not what makes the rule true. */
  const [tagOpen, setTagOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [tagged, setTagged] = useState([]);   // handles

  /* Taking your own name off somebody else's post.

     ⚠️ Optimistic, unlike block (which deliberately waits for the
     database, because a block that only LOOKS like it worked is
     dangerous). This is the milder case — the worst outcome of being
     wrong is a name reappearing on the next refresh, and the person is
     standing right there watching. Making them wait on a round trip to
     remove their own name from a post reads as the button not working.

     🔴 remove_my_tag() takes only a post id. There is no "who"
     parameter, so it can only ever remove YOUR tag. */
  async function untag(postId) {
    setTags((t) => ({
      ...t,
      [postId]: (t[postId] || []).filter((x) => !x.is_me),
    }));
    await supabase.rpc('remove_my_tag', { p_post: postId });
  }

  async function openTags() {
    setTagOpen((v) => !v);
    if (friends.length) return;
    /* my_friends() already returns handles and display names — the friends
       page uses the identical call. No new query for this. */
    const { data } = await supabase.rpc('my_friends');
    setFriends(data || []);
  }

  const MAX_PHOTOS = 10;
  const photos = media.filter((m) => !m.isVideo);
  const video  = media.find((m) => m.isVideo) || null;
  const canAddPhoto = photos.length < MAX_PHOTOS;
  const canAddVideo = !video;

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

  /* ---- putting out a record (0058) ----
     `rec` holds what DropSheet collected; the sheet itself writes nothing.
     ⚠️ ONE post() creates both rows, so a drop takes the identical insert
     path as every other post — audience, anonymity and all — instead of a
     second code path that would drift from the first. */
  const [rec, setRec] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [recDropped, setRecDropped] = useState(false);

  /* Shown under the composer when a post fails. */
  const [postErr, setPostErr] = useState('');

  /* ⚠️ The composer has TWO busy states and they are not the same thing.
     `busy` is "a post is being sent"; this one is "a photo is still
     uploading". Without it the Post button stays live during the upload,
     so a fast thumb posts before the photo has finished landing — and the
     picture is silently dropped. */
  const [uploading, setUploading] = useState(false);

  function toggleAnon() {
    const next = !anon;
    if (next && media.length) { setMedia([]); setPhotoDropped(true); }
    else setPhotoDropped(false);
    /* 🔴 THE TAGS GO TOO, and this is the sharpest of the three.
       0067 refuses a tag on an anonymous post outright — "@handle was
       using last night" from an account with no name attached is the
       worst thing this app could carry. Without this the chips would
       merely HIDE while the handles stayed in state, and the tag attempt
       would fail seconds after the choice was made. */
    if (next) { setTagged([]); setTagOpen(false); }
    /* ⚠️ THE RECORD GOES TOO, and for the same reason the photo does.
       0058 refuses an anonymous drop outright — a release is credited work
       by definition. Without this the chip merely HIDES while `rec` stays
       in state, and the post fails at the database several seconds after
       the choice was made, with a constraint error nobody can act on.

       Silently keeping it would be worse: somebody would post anonymously
       believing their record went with it. */
    if (next && rec) setRecDropped(true); else setRecDropped(false);
    if (next) setRec(null);
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
      /* ⚠️ Spread photo_urls in (0065). Miss it and a post's second
         through tenth pictures are never signed — they render as broken
         frames rather than raising anything, so nobody reports it. */
      for (const p of [...(Array.isArray(r.photo_urls) ? r.photo_urls : []),
                       r.photo_url, r.video_url, r.display_avatar_photo]) {
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

  /* ---- the Home dot clears here, because this is where the reply is ----

     ⚠️ ONLY 'reply'. Passing no kind would clear the Chat dot too, and
     somebody would lose a message they never saw because they glanced at
     the wall. Each tab puts out its own light.

     Runs once per mount. It's a no-op write when nothing is unread — the
     UPDATE's own `read_at is null` makes it free — so there's no need to
     ask first. */
  useEffect(() => {
    supabase.rpc('notifications_mark_read', { p_kind: 'reply' })
      .then(() => router.refresh())
      .catch(() => {});   // a dot that stays lit is not worth an error
    /* eslint-disable-next-line */
  }, []);
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
      /* ⚠️ The previews are re-read HERE and nowhere else, and that is a
         deliberately narrow choice. refresh() runs when a reply is added
         or somebody is blocked — the only two things that change what's
         underneath a post.

         The tidier-looking build is an effect watching `posts`, the way
         signMissing does. It would be wrong: `posts` is also replaced on
         every LIKE, so tapping a heart would re-fetch every conversation
         on the page. A heart is optimistic precisely because it must
         cost nothing. */
      setConvo(await fetchPreviews(supabase, data.map((p) => p.id)));
      setTags(await fetchTags(supabase, data.map((p) => p.id)));
      const freshDrops = await fetchDrops(supabase, data.map((p) => p.id));
      setRecs(freshDrops);
      signMissing(Object.values(freshDrops).map((d) => ({
        photo_url: d.media_path, video_url: d.art_path })));
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
    /* ⚠️ THE BUG, Aug 17. This used to read `if (!body) return;` — so
       attaching a photo and tapping Post with no caption did NOTHING. No
       post, no error, no explanation. The Post button was greyed out too,
       and the database had `length(body) >= 1` on top.

       Three separate locks all saying "words are mandatory", written back
       when a post could only BE words. A picture is a post. */
    if (!body && !media.length && !rec) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      /* ⚠️ `anon ? null : …` looks redundant next to the CHECK constraint
         in 0022, and it is — deliberately. The database is the wall; this
         line is so a member never MEETS the wall. Belt and braces, where
         the braces produce a readable app and the belt produces a
         guarantee. */
      /* One attachment, routed to the right column by what it IS. The
         other column goes explicitly null rather than being left out —
         `one_medium_per_post` compares two values, and "absent" and
         "null" are the same to Postgres but not to a reader. */
      /* ⚠️ Split here and nowhere else. The composer holds one list; the
         database wants an array of photos and a single video. Doing the
         split at the insert means there is exactly one line in the app
         that knows the shape the table expects. */
      const attached   = anon ? [] : media;
      const photoPaths = attached.filter((m) => !m.isVideo).map((m) => m.path);
      const videoPath  = (attached.find((m) => m.isVideo) || {}).path || null;
      /* ⚠️ Anonymous forces the audience back to open, for the same
         belt-and-braces reason as the photo above — 0045 has a CHECK that
         refuses anonymous + friends-only outright, and this line is so a
         member never meets it.

         The rule reads backwards until you sit with it: a SMALL audience
         exposes an anonymous author rather than protecting them. Everyone
         who can see a friends-only post knows the author is one of their
         own friends, and each of them knows their own friend list. With a
         handful of friends that's a name. Anonymity needs a crowd. */
      /* 🔴 THE ID IS MADE HERE, NOT READ BACK. THIS BROKE POSTING.

         The obvious version is `.insert(...).select('id').single()` — and
         it took the whole app down for everyone, not just drops, with
         "permission denied for table posts".

         RULE 1 of this schema: members read through feed_posts, NEVER the
         base table, because `posts` carries author_id on anonymous posts.
         So `authenticated` has INSERT and DELETE on posts and no SELECT —
         and .select() on an insert needs SELECT. The grant was right; my
         insert was wrong.

         ⚠️ Generating the uuid client-side is not a workaround, it's the
         correct shape: we need to KNOW the id, not to be TOLD it. A v4
         uuid from the browser is the same value the database would have
         made, and it means the drop can be attached without ever reading
         a row back. */
      const postId = (crypto.randomUUID && crypto.randomUUID())
        || (URL.createObjectURL(new Blob()).split('/').pop());

      const { error } = await supabase.from('posts')
        .insert({ id: postId, author_id: user.id, body, is_anonymous: anon,
                  audience: anon ? 'open' : audience,
                  /* ⚠️ photo_urls, NOT photo_url. The 0065 trigger fills in
                     the old singular column from photo_urls[1], so nothing
                     needs to write it — and writing both would be two
                     sources of truth for one fact. Send null rather than an
                     empty array: the constraint treats an empty array as
                     invalid, and "no photos" is genuinely absence. */
                  photo_urls: photoPaths.length ? photoPaths : null,
                  video_url: videoPath });
      if (error) throw error;

      /* 🔴 THE DROP IS INSERTED SECOND, AND THE ORDER MATTERS. If this
         fails — the one-a-week limit, a bad claim — the post survives as
         an ordinary post and the member sees the reason. The other order
         would leave a record row pointing at nothing. */
      if (rec) {
        const { error: dErr } = await supabase.from('drops')
          .insert({ post_id: postId, ...rec });
        if (dErr) throw new Error(dErr.message);
      }

      /* 🔴 TAGS LAST, AND THEY CANNOT LOSE THE POST.
         Unlike the drop above — which throws, because a record that
         didn't attach is a broken promise — a tag that fails is a name
         that didn't stick. The post is already saved and is still worth
         having, so this reports rather than throws.
         ⚠️ anon is checked here as well as in toggleAnon: somebody can
         tag friends, then tap anonymous, and state resets are easy to
         get wrong. The database would refuse anyway; this stops us
         asking it to. */
      if (!anon && tagged.length) {
        const { refused } = await attachTags(supabase, postId, tagged);
        if (refused.length) {
          setPostErr(`Posted, but couldn’t tag ${refused.map((h) => '@' + h).join(', ')}.`);
        }
      }
      setText('');
      setRec(null);
      setRecDropped(false);
      setMedia([]);
      setPhotoDropped(false);
      setTagged([]);
      setTagOpen(false);
      setAudience('open');
      // re-read through the VIEW, never the base table
      const { data } = await supabase
        .from('feed_posts').select('*').order('created_at', { ascending: false }).limit(60);
      setPosts(data || []);
      /* ⚠️ The record has to be re-read HERE, in the same breath as the
         posts. router.refresh() also refetches it, eventually — and
         "eventually" is what made a brand new poster invisible. */
      if (data) {
        const freshDrops = await fetchDrops(supabase, data.map((p) => p.id));
        setRecs(freshDrops);
        signMissing(Object.values(freshDrops).map((d) => ({
          photo_url: d.media_path, video_url: d.art_path })));
      }
      router.refresh();
    } catch (e2) {
      /* ⚠️ Was alert(). On a phone an alert covers the screen and tells you
         nothing you can act on. Worse, the failure that actually happened
         tonight produced NO alert at all, because the function returned
         before it ever tried. An error you can see beats an error that is
         technically well-handled somewhere you aren't looking. */
      setPostErr(e2.message || "That didn't post. Try again.");
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
                 /* Once a photo is attached the same box becomes the caption,
                    and it says so. Nothing changes underneath — a post is a
                    body and an optional picture — but "add a caption" tells
                    you the words are now OPTIONAL, which is the part that
                    was impossible to guess while the Post button sat grey. */
                 placeholder={rec ? 'Say something about it… (optional)'
                                    : media.length ? 'Add a caption… (or leave it blank)'
                                    : anon ? 'Nobody will see who wrote this…'
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
          {/* ⚠️ The camera DISAPPEARS at the cap rather than greying out —
              same reasoning as the anonymous case just above. A disabled
              button is an invitation to work out how to enable it, and
              here there is no answer except "remove one", which the ×
              buttons below already say more clearly.

              ⚠️ It also disappears when there is a video AND ten photos,
              because at that point there is genuinely nothing left to
              add. */}
          {!anon && !rec && (canAddPhoto || canAddVideo) && (
            /* ONE button, both media. A separate 🎥 next to the 📷 was the
               obvious build and it's worse: two controls that do the same
               job, on the narrowest row in the app, forcing a decision
               ("which button do I want?") the file picker is about to ask
               again anyway. The picker already knows the difference. */
            <PhotoUpload kind="post" disabled={busy} className="camera"
                         /* ⚠️ Narrow the picker once a video is attached —
                            only one video per post, and letting somebody
                            choose a second means uploading a file we are
                            about to refuse. Cheaper to not offer it. */
                         accept={canAddVideo ? 'image/*,video/mp4,video/quicktime' : 'image/*'}
                         label={media.length ? `+${media.length}` : '📷'}
                         onBusy={setUploading}
                         onDone={(path, preview, isVideo) => {
                           setMedia((m) => {
                             /* ⚠️ Guard here as well as in the picker. The
                                upload is async — two quick taps can both
                                pass the check above and land here, and the
                                database would refuse the eleventh with a
                                raw constraint error. */
                             if (isVideo && m.some((x) => x.isVideo)) return m;
                             if (!isVideo && m.filter((x) => !x.isVideo).length >= MAX_PHOTOS) return m;
                             return [...m, { path, preview, isVideo }];
                           });
                           setFreshUrls((u) => ({ ...u, [path]: preview }));
                           setPostErr('');
                         }} />
          )}
          {/* ⚠️ `!text.trim() && !photo` — NOT `!text.trim()`. A photo on its
              own is a post. The old version left this button dead while a
              picture sat attached above it, with nothing on screen saying
              why. A disabled button gives no reason; it just doesn't work. */}
          <button type="submit" className="send"
                  disabled={busy || uploading || (!text.trim() && !media.length && !rec)}
                  aria-label="Post">
            {busy ? '…' : uploading ? '…' : 'Post'}
          </button>
        </div>

        {/* ⚠️ Every attachment gets its OWN × (0065). The old single slot
            only ever needed one. With ten of them, a single "clear" would
            mean losing nine good pictures to remove one bad one — and the
            bad one is usually the reason you looked. */}
        {media.map((m, i) => (
          <div className="cphoto" key={m.path}>
            {m.isVideo ? (
              /* ⚠️ `controls` and nothing else. No autoplay on the preview —
                 this is the thing you are about to say to people, and it
                 should not start talking at you in a quiet room while
                 you're deciding whether to send it. `playsInline` stops
                 iOS from throwing it fullscreen the moment it's touched,
                 which loses you the composer you were standing in. */
              <video src={m.preview} controls playsInline preload="metadata" />
            ) : (
              <img src={m.preview}
                   alt={media.length > 1
                     ? `Photo ${i + 1} of ${media.filter((x) => !x.isVideo).length} you're about to post`
                     : "The photo you're about to post"} />
            )}
            <button type="button" className="cphoto-x"
                    aria-label={m.isVideo ? 'Take the video off' : `Take photo ${i + 1} off`}
                    disabled={busy}
                    /* ⚠️ Remove by PATH, not by index. Indexes shift the
                       moment anything else is removed, so a second tap on
                       a stale render would take off the wrong picture. */
                    onClick={() => setMedia((s) => s.filter((x) => x.path !== m.path))}>×</button>
          </div>
        ))}

        {/* Only once there is more than one — a count over a single photo
            is noise. ⚠️ It says what is left rather than what is used,
            because "3 of 10" invites you to fill it and this is not a
            scoreboard. */}
        {photos.length > 1 && (
          <p className="canon-note">
            {photos.length} photos{video ? ' and a video' : ''}
            {canAddPhoto ? '' : ' · that’s the limit'}
          </p>
        )}

        {/* ---- tagging a friend (0067) ----
            ⚠️ ABSENT when anonymous, not disabled — the same reasoning as
            the camera. A greyed-out "tag" is an invitation to work out
            how to enable it, and the answer would be "stop being
            anonymous". Nobody gets nudged toward that trade by chrome. */}
        {!anon && (
          <div className="ctags">
            <button type="button" className="tagbtn" onClick={openTags}
                    aria-expanded={tagOpen} disabled={busy}>
              {tagged.length ? `Tagged ${tagged.length}` : '＠ Tag a friend'}
            </button>

            {tagged.map((h) => (
              <span className="tagchip" key={h}>
                @{h}
                <button type="button" aria-label={`Untag ${h}`} disabled={busy}
                        onClick={() => setTagged((t) => t.filter((x) => x !== h))}>×</button>
              </span>
            ))}

            {tagOpen && (
              <div className="taglist">
                {/* ⭐ Only friends appear, because only friends can be
                    tagged. The list IS the rule, made visible. */}
                {friends.length === 0 ? (
                  <p className="tagnone">
                    You can only tag friends, and you haven’t got any yet.
                    {' '}<Link href="/friends">Find some</Link>.
                  </p>
                ) : friends.map((f) => {
                  const on = tagged.includes(f.handle);
                  return (
                    <button type="button" key={f.handle}
                            className={'tagopt' + (on ? ' on' : '')}
                            aria-pressed={on}
                            onClick={() => setTagged((t) =>
                              on ? t.filter((x) => x !== f.handle) : [...t, f.handle])}>
                      {f.display_name || f.handle}
                      <span>@{f.handle}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {uploading && <p className="canon-note">Adding it…</p>}
        {postErr && <p className="phserr" role="alert">{postErr}</p>}

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

        {/* Who can see it. Hidden entirely while anonymous — not disabled,
            hidden. A greyed-out "Friends only" next to the anonymous chip
            reads as a thing you're being denied, and invites people to
            turn anonymity off to reach it. When it can't apply it isn't
            part of the composer. Same call as the camera above. */}
        {!anon && (
          <div className="cas cas-aud">
            <span>Who sees it</span>
            <button type="button"
                    className={'asme' + (audience === 'friends' ? ' fr' : '')}
                    aria-pressed={audience === 'friends'}
                    onClick={() => setAudience(audience === 'friends' ? 'open' : 'friends')}>
              {audience === 'friends' ? '👋 your people' : '🌍 everyone'}
            </button>
            <span className="cas-hint">
              {audience === 'friends'
                ? 'tap to open it up'
                : 'tap to keep it to friends'}
            </span>
          </div>
        )}

        {/* ---- PUTTING OUT A RECORD — the second option ----

            Ty: "put it in post, but as a second option." It sits with
            "Posting as" and "Who sees it" because that row is already
            where you say WHAT KIND of post this is, and a record is a kind
            of post rather than a rival action.

            ⚠️ "tap if you made something" — NOT "for musicians". Nobody
            should have to identify as an artist to use it; the person this
            most matters to may be putting up the first thing they've made
            in ten years, and they will not tap a button labelled for
            musicians.

            ⚠️ Hidden while anonymous, like the camera and the audience
            chip. A drop is credited work — 0058 refuses an anonymous one
            outright — so offering it here would be offering something the
            database will reject. */}
        {!anon && (
          <div className="cas cas-aud casrec">
            <span>Putting out</span>
            <button type="button" className={'asme' + (rec ? ' on' : '')}
                    aria-pressed={!!rec}
                    onClick={() => (rec ? setRec(null) : setSheet(true))}>
              {rec ? `♪ ${rec.title}` : '♪ a record'}
            </button>
            <span className="cas-hint">
              {rec ? 'tap to take it off' : 'tap if you made something'}
            </span>
          </div>
        )}

        {/* The explanation, and only when it's relevant. A permanent note
            about anonymous photo rules on a composer nobody is using
            anonymously is noise; the same sentence at the moment it
            applies is an answer. */}
        {anon && (
          <p className="canon-note">
            {photoDropped
              ? (recDropped
                  ? 'Your record was taken off — putting one out means putting your name on it. Anonymous posts are words only.'
                  : 'Taken off — anonymous posts are words only. A face in a mirror or a street sign through a window is the quickest way to stop being anonymous by accident, and a video adds your voice and whatever the room behind you is saying.')
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

        {/* DOM order is reading order: newest first. Position is CSS only.

            ⚠️ The list is now posts AND content, interleaved by lib/mix.js.
            The rules that protect the wall's promise live in that file, not
            here — chiefly that a card never sits directly above the post
            the wall has singled out for being unanswered. */}
        {mixFeed(posts, content, { lonelyId }).map((row) => {
          if (row.type === 'content') {
            return <ContentCard key={'c' + row.item.id} item={row.item}
                                thumbBase={thumbBase} canHide={canHide} />;
          }
          const p = row.post;
          const w = weight(p, p.id === lonelyId);
          return (
            <article
              key={p.id}
              className={
                'item ' + w +
                (p.is_anonymous ? ' screened' : '') +
                (p.id === posts[0]?.id ? ' newest' : '')
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

              {/* ⭐ A MEMBER'S RECORD (0058). When a post carries a drop the
                  poster IS the post — it replaces the body, the photo and
                  the link player, because a release is one object and
                  stacking a caption, a picture and a poster makes three.

                  ⚠️ The post header, footer, replies, ⋯ menu and every
                  audience rule above and below are untouched. A drop is a
                  post with a record attached, not a new kind of thing —
                  which is why none of that had to be rebuilt. */}
              {recs[p.id] && (
                <DropCard
                  drop={recs[p.id]}
                  artUrl={urlFor(recs[p.id].art_path) || dropUrls[recs[p.id].art_path] || null}
                  mediaUrl={urlFor(recs[p.id].media_path) || dropUrls[recs[p.id].media_path] || null}
                />
              )}

              {/* A photo-only post has an empty body. Rendering the empty
                  paragraph anyway leaves a blank gap above the picture that
                  looks like text failed to load. */}
              {p.body && !recs[p.id] ? <p className="bd"><Body text={p.body} /></p> : null}

              {/* ⭐ Aug 23. A member posted his music and the link came out
                  as plain text you had to copy and leave for. It plays
                  here now. ⚠️ Nothing loads until somebody taps — see
                  components/Linked.jsx. */}
              {p.body && !recs[p.id] ? <Player text={p.body} /> : null}

              {/* ---- who's tagged (0067) ----
                  ⚠️ "with" rather than "tagged": the word tagged belongs
                  to a scrapbook. This line usually means somebody was
                  there, and reading "with Nic and Dave" is how a person
                  would actually say it.
                  🔴 The × only appears on YOUR OWN tag — is_me comes from
                  the view, so this component never compares ids. */}
              {(tags[p.id] || []).length > 0 && (
                <p className="ptags">
                  <span className="ptagw">with</span>
                  {(tags[p.id] || []).map((t) => (
                    <span className="ptag" key={t.handle}>
                      <Link href={`/u/${t.handle}`}>@{t.handle}</Link>
                      {t.is_me && (
                        <button type="button" aria-label="Take my name off this post"
                                title="Take my name off this post"
                                onClick={() => untag(p.id)}>×</button>
                      )}
                    </span>
                  ))}
                </p>
              )}

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
              {(() => {
                /* ⚠️ Read photo_urls, fall back to photo_url (0065). The
                   fallback is not belt-and-braces — a page rendered from a
                   cached payload during the deploy has only the old column,
                   and without it those posts render with no picture at all. */
                const shots = (Array.isArray(p.photo_urls) && p.photo_urls.length
                  ? p.photo_urls
                  : (p.photo_url ? [p.photo_url] : [])).filter((s) => urlFor(s));
                if (!shots.length) return null;

                /* ⭐ ONE PHOTO LOOKS EXACTLY AS IT ALWAYS DID. Most posts
                   carry one, and making them all become a grid to support
                   the rare ten would change every existing post on the wall
                   to solve a problem none of them have. */
                if (shots.length === 1) {
                  return (
                    <div className="pphoto">
                      <img src={urlFor(shots[0])} alt="" loading="lazy" />
                    </div>
                  );
                }

                /* ⚠️ data-n drives the grid in CSS rather than inline
                   styles, so two, three and four-plus can each have their
                   own shape without this component knowing about any of
                   them. Capped at 4 in the attribute — beyond that they all
                   lay out the same way. */
                return (
                  <div className="pgrid" data-n={Math.min(shots.length, 4)}>
                    {shots.map((s, i) => (
                      <img key={s} src={urlFor(s)} loading="lazy"
                           /* ⚠️ alt="" everywhere else, but with several
                              pictures a screen reader otherwise hears
                              nothing at all where sighted people see six
                              things. The position is the only honest thing
                              we know about them. */
                           alt={`Photo ${i + 1} of ${shots.length}`} />
                    ))}
                  </div>
                );
              })()}

              {/* ⚠️ NO autoplay, and this is a decision rather than an
                  oversight. Every feed on earth plays video at you the
                  moment it scrolls past, because it lifts the numbers.
                  Here a video is somebody talking about the worst thing
                  that ever happened to them, and it should not start
                  playing to a room because a thumb moved.

                  (0014 does autoplay a song on a profile — different
                  thing. You went to ONE person's page on purpose, and the
                  off switch sits under the song. This is a feed you're
                  moving through.)

                  `preload="metadata"` fetches the first few bytes only, so
                  the frame and duration are right without pulling tens of
                  megabytes down a phone connection for a video nobody
                  taps. `playsInline` keeps it in the feed on iOS instead
                  of hijacking the whole screen. */}
              {p.video_url && urlFor(p.video_url) && (
                <div className="pphoto pvideo">
                  <video src={urlFor(p.video_url)} controls playsInline
                         preload="metadata" />
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

              {/* ---- THE CONVERSATION, ON THE WALL ----

                  Aug 23. Ty: "allow other users to see the replies. it
                  will allow others to see the convo and join in."

                  ⚠️ NOT WRAPPED IN A BUTTON, and that's a real constraint
                  rather than a style choice. Replies can contain links —
                  <Body> renders anchors — and an <a> inside a <button> is
                  invalid HTML that browsers resolve differently from each
                  other. So the preview is static text, and the way in
                  stays the footer button underneath it, which is a proper
                  control with a real focus ring.

                  ⚠️ Rendered from `convo`, which comes from feed_comments,
                  so an anonymous reply arrives already carrying its
                  per-thread alias and a null author. There is nothing for
                  this markup to hide — the same rule as the post header
                  above it. */}
              {(convo[p.id] || []).length > 0 && (
                <div className="rpv">
                  {/* Shown only when there's more than fits. Says how many
                      are ABOVE what you can see, so the number means
                      something you can act on rather than restating the
                      count already in the footer. */}
                  {p.comment_count > convo[p.id].length && (
                    <button type="button" className="rpvm" onClick={() => setOpen(p)}>
                      {p.comment_count - convo[p.id].length} earlier{' '}
                      {p.comment_count - convo[p.id].length === 1 ? 'reply' : 'replies'} ›
                    </button>
                  )}
                  {convo[p.id].map((c) => (
                    <div key={c.id}
                         className={'rpvr' + (c.is_anonymous ? ' screened' : '')}>
                      <span className="rpvw">
                        {c.display_name}{c.is_mine ? ' · you' : ''}
                      </span>
                      <span className="rpvb"><Body text={c.body} /></span>
                    </div>
                  ))}
                </div>
              )}

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
                {/* ⚠️ THE WORDING CHANGED WHEN THE REPLIES BECAME VISIBLE.
                    It used to read "3 replies", which was the only clue
                    a conversation existed at all. Now the conversation is
                    sitting right above it, and a button that counts what
                    you can already see is dead weight in the one spot
                    where the invitation should be.

                    So: nothing there → "say something". Something there →
                    "join in". The number moved to the "N earlier replies"
                    link, where it's still doing a job. */}
                <button className="replies" onClick={() => setOpen(p)}>
                  {p.comment_count === 0 ? 'say something' : 'join in'}
                </button>
                {/* is_mine, never author_id — an anonymous post still shows
                    the author their own controls without exposing them */}
                {/* ⚠️ THE ⋯ NOW APPEARS ON YOUR OWN POSTS, and this is a bug
                    fix rather than a tidy-up. It was hidden here because
                    "there is nobody to report or block but yourself" —
                    true, and it left nowhere to put DELETE. A member told
                    Ty on Aug 19 he couldn't take his own post down. He was
                    right: the database allowed it and the API existed, and
                    the wall showed him the word "yours" with nothing to
                    tap. The menu decides what to offer from post.is_mine. */}
                {p.is_mine && <span className="mine">yours</span>}
                {/* ⚠️ Shown to EVERYONE who can see the post, not just the
                    author. A reader needs to know they're in a smaller
                    room than usual before they answer — replying to what
                    you think is a public post, in front of four people,
                    is a different act than you thought you were doing. */}
                {p.audience === 'friends' && (
                  <span className="mine aud">friends only</span>
                )}
                <button className="dots"
                        aria-label={p.is_mine ? 'Delete this post' : 'Report or block'}
                        onClick={() => setMenu(p)}>⋯</button>
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

      {sheet && (
        <DropSheet
          defaultArtist={me.name || me.handle || ''}
          onClose={() => setSheet(false)}
          onDone={(cfg) => { setRec(cfg); setSheet(false); setPostErr(''); }}
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
