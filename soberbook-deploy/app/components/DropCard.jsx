'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
/* ⚠️ THE SHARED, ALREADY-BLESSED ELEMENT — never a new <audio> tag. iOS
   blesses an ELEMENT, not a page: one that no tap has ever touched is
   refused every single time, which is what made profile songs silent on
   every phone until 23 Aug while working perfectly on a laptop. */
import { play as playShared, release as releaseShared, element as sharedEl } from '../../lib/song-audio';
/* ⚠️ THE SAME function the wall's server uses, so the two cannot drift —
   and it reads feed_drops, which is what withholds an unreleased file. */
import { fetchDrops } from '../../lib/drops';

/* =====================================================================
   A MEMBER'S RECORD, ON THE WALL. THE ONLY LOUD CARD HERE.

   Ty, Aug 23: "now i want to do something very special for musicians!!!"
   …then: "keep it all on the home feed. we just need to make their box
   unique."

   ⭐ WHY THIS ONE GETS TO SHOUT WHEN NOTHING ELSE DOES.

   Every other card on this wall was deliberately made quieter than a
   member's post — the YouTube cards recede because they're borrowed.
   A member's own record is the one thing inside this app that is MEANT
   to be loud, so it wears the poster brand: toner black, acid, halftone,
   condensed caps. Until now that brand only existed on the Readings page
   and on the printed flyers.

   ⚠️ A gig poster, specifically, because that is the visual language
   musicians already live in. It isn't a style choice borrowed from
   nowhere — it's the object a release has always come wrapped in.

   ---------------------------------------------------------------------
   THREE STATES, AND THE DIFFERENCE BETWEEN THEM IS ENFORCED IN THE
   DATABASE, NOT HERE.

     1 · COMING      — is_out false. `media_path` comes back NULL from the
                       view for everyone but the artist, so there is no
                       file location in this browser to fish out. The
                       countdown is the only thing rendered because it is
                       the only thing we HAVE.
     2 · OUT, ONLY HERE — is_exclusive_now. `external_url` is withheld by
                       the view during the window, so this component
                       cannot show an outbound link even by mistake.
     3 · OUT EVERYWHERE — the link appears, because now it works.

   ⚠️ This component makes none of those decisions. It renders what it was
   given. That is the point: a UI bug can't leak an unreleased track,
   because the string never arrives.
   ===================================================================== */

/* ⚠️ Counts down against a SERVER timestamp, and the difference is
   computed fresh each tick rather than decremented. A decrementing
   counter drifts when a phone sleeps — you come back after twenty minutes
   and it's twenty minutes behind, cheerfully counting down to a moment
   that already passed. */
function useCountdown(iso) {
  /* ⚠️ Starts at 0 rather than computing from the clock on first render.
     A server render and the browser's first render happen at different
     instants, so computing here produces a hydration mismatch — React
     shouts, and on a bad day swaps the DOM out from under you. The effect
     fills it in immediately after mount, which is the same frame to a
     human and the correct thing to React. */
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, new Date(iso) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

function parts(ms) {
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/* "Friday 8:00pm" in the reader's own timezone. ⚠️ Not the artist's —
   the whole point of an appointment is that everybody knows when to be
   here, in their own terms. */
function when(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'long', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function DropCard({ drop, artUrl, mediaUrl }) {
  /* ⚠️ EVERY HOOK ABOVE THE GUARD, UNCONDITIONALLY.

     The obvious order — `if (!drop) return null` first, then the
     countdowns — is a rules-of-hooks violation: React identifies hooks by
     CALL ORDER, so a render that bails early runs fewer of them and every
     hook after that point gets handed the wrong state. It doesn't warn,
     it corrupts. The guard goes after. */
  const [on, setOn] = useState(false);
  /* ⚠️ ABOVE THE GUARD with the countdowns, for the same reason: React
     identifies hooks by call order, so a render that bails early runs
     fewer of them and corrupts the rest. null means "haven't asked the
     server yet" and is deliberately different from false. */
  const [reminded, setReminded] = useState(null);
  const [arming, setArming] = useState(false);
  const left    = useCountdown(drop && !drop.is_out ? drop.release_at : null);
  const winLeft = useCountdown(drop && drop.is_exclusive_now ? drop.exclusive_until : null);

  /* 🔴 ASKED PER CARD, AND ONLY FOR A RECORD STILL COUNTING DOWN.

     The answer is about YOU and nobody else — drop_reminded() has no
     variant that counts the waiting or names them, because a "47 people
     are waiting" badge is the play-count problem wearing a hat, and this
     card is the one place in the app that was built to have no score.

     ⚠️ Fails quiet. If the read doesn't come back the link stays in its
     unasked state, which costs a duplicate tap at worst — the insert is
     ON CONFLICT DO NOTHING, so asking twice is asking once. */
  useEffect(() => {
    if (!drop || drop.is_out) return;
    let alive = true;
    browserClient().rpc('drop_reminded', { p_post_id: drop.post_id })
      .then(({ data }) => { if (alive) setReminded(!!data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [drop?.post_id, drop?.is_out]);

  /* =====================================================================
     🔴 THE CARD MUST COME ALIVE BY ITSELF AT ZERO. 8 Sept.

     Ty's first real premiere: *"when a countdown hit zero, nothing
     happened. Nobody's gonna be there as long as I was trying to figure
     it out. I had to restart the window over again and then hit play."*

     ⭐ THE CAUSE: `drop.is_out` is a SERVER-RENDERED PROP and nothing ever
     changes it. useCountdown ticks `left` down to zero perfectly — and
     then the very next line, `if (!drop.is_out)`, still returns the
     COMING state, forever, because that boolean was decided when the page
     loaded. The clock reaches zero and the card keeps waiting.

     🔴 So every member sitting on the wall at release time saw a frozen
     countdown, and only somebody who thought to reload found the record.
     On the one feature whose entire job is a shared moment, that is the
     worst possible failure — everyone who showed up on time saw nothing.

     ⚠️ SCHEDULED AGAINST THE CLOCK, NOT AGAINST `left`. useCountdown
     deliberately starts at 0 on first render to avoid a hydration
     mismatch (see its own note), so `if (left === 0) refresh()` would
     fire instantly on mount for every card on the page. Reading
     release_at directly is the only honest source.

     ⚠️ +2s of slack. The browser's clock and the database's are not the
     same clock, and refreshing a moment early re-renders the identical
     waiting card and gives up its one shot.

     ⚠️ router.refresh() rather than a client re-fetch, because the media
     URL has to be SIGNED and only the server can do that — see
     lib/sign-photos.js. Asking the server again is what turns
     `media_path: null` into a playable record. */
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  /* 🔴 THE CARD FETCHES ITS OWN RELEASED STATE — router.refresh() IS NOT
     ENOUGH ON ITS OWN, AND THAT COST US A LIVE TEST.

     Ty watched a real countdown: the music played on time, the clock hit
     zero, and the video never started. ⭐ The cause is in Wall.jsx:

         const [recs, setRecs] = useState(drops);

     The drops are copied into STATE at first mount, and a useState
     initialiser runs exactly once. So refresh() re-rendered the server,
     the server sent back `is_out: true` with a freshly signed file — and
     the wall threw it away and kept handing this card the row it had at
     page load, where the record is still unreleased. The countdown
     finishes and the card is still holding yesterday's answer.

     ⚠️ Rather than change how the wall stores 60 posts at 8pm, the card
     asks for itself. `fetchDrops` is the same function the server uses,
     so the two cannot drift, and `feed_drops` is what decides whether the
     file may be handed over at all — the exclusive is still enforced in
     the view, not here.

     ⚠️ The path then has to be SIGNED, and only the server can do that.
     Same endpoint the wall's photo repair uses. */
  const [fresh, setFresh] = useState(null);
  const [freshUrl, setFreshUrl] = useState(null);
  async function pullReleased() {
    try {
      const map = await fetchDrops(browserClient(), [drop.post_id]);
      const row = map && map[drop.post_id];
      if (!row || !row.is_out) return;
      setFresh(row);
      if (row.media_path) {
        const res = await fetch('/api/photo/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [row.media_path] }),
        });
        const { urls } = await res.json();
        if (urls && urls[row.media_path]) setFreshUrl(urls[row.media_path]);
      }
    } catch {
      /* Swallowed like every other read on this wall: a card that stays
         on its countdown is a disappointment, an error banner over
         somebody's feed is a broken app. router.refresh() below is the
         second chance, and a reload is the third. */
    }
  }

  useEffect(() => {
    if (!drop || drop.is_out || opened || !drop.release_at) return;
    const ms = new Date(drop.release_at) - Date.now();
    const go = () => { setOpened(true); pullReleased(); router.refresh(); };
    if (ms <= 0) { go(); return; }
    /* ⚠️ setTimeout is capped at ~24.8 days by the spec; anything longer
       silently fires IMMEDIATELY. A record scheduled a month out would
       refresh on mount forever without this. */
    if (ms > 86_400_000) return;
    const t = setTimeout(go, ms + 2000);
    return () => clearTimeout(t);
  }, [drop?.release_at, drop?.is_out, opened, router]);

  /* =====================================================================
     ▶️ IT STARTS ITSELF — BUT ONLY FOR SOMEBODY WHO WATCHED THE CLOCK.

     Ty: *"when it hits zero, it should play automatically the video. And
     then after that, you have to play it every time. Just like YouTube."*

     ⭐ `opened` IS THE CONSENT SIGNAL, AND IT COSTS NOTHING EXTRA. It is
     true only in a browser that was sitting on this card when the
     countdown ran out — which is exactly the person who came for the
     premiere. Somebody scrolling past this record three hours later
     mounts with `opened` false and gets an ordinary card with a play
     button, silent until they choose it.

     🔴 That is what keeps the August rule intact without making a music
     video look like a broken image. The line was never "don't autoplay",
     it is "nobody's phone makes noise they didn't ask for" — and sitting
     through a countdown IS asking. See the drop-room design note.

     ⚠️ Fires ONCE. `on` is not reset anywhere, so when the video ends the
     member gets the normal controls and has to press play again — Ty's
     "after that, you have to play it every time". No loop, deliberately:
     a record restarting forever in somebody's room at 2am is hostile. */
  /* ⭐ THE FRESHEST ROW WINS, and every hook below reads these rather than
     the props. `fresh` is what this card fetched for itself at zero;
     `drop` is what the wall handed down, which can be stale for the
     reason in the note above. */
  const liveDrop = fresh || drop;
  const liveUrl  = freshUrl || mediaUrl;

  useEffect(() => {
    if (opened && liveDrop && liveDrop.is_out && liveUrl) setOn(true);
  }, [opened, liveDrop?.is_out, liveUrl]);

  /* =====================================================================
     🎹 THE LAST MINUTE HAS MUSIC.

     Ty asked for twenty seconds, heard it run for real, and moved it:
     *"the music plays at exactly twenty seconds. Let's make that go a
     little further and start the music at one minute."*

     ⭐ A MINUTE AND NOT THE WHOLE WAIT, and that is the point: a loop
     running for two hours stops being heard by minute three. Starting it
     near zero makes it a CUE — silence, then music, then the video. The
     change in the room is what says it's happening.

     ⚠️ Twenty was too short to register as anticipation; it arrived and
     was over. Sixty gives it room to be noticed and then waited through.
     This number is the whole feel of the moment — if it moves again it
     moves HERE, and nowhere else needs touching.

     ⚠️ It plays through lib/song-audio's SHARED element, keyed to this
     post. That module owns the app's one speaker: whoever plays last owns
     it, so a member with a profile song open does not end up with two
     things playing at once — the room takes the floor, which is correct,
     because a countdown at four seconds outranks background music.

     ⚠️ THE FADE IS A VOLUME RAMP, not a fade in the file. A loop snapping
     on at exactly 20.0 is a jump scare; the point is anticipation.

     🔴 play() THROWS IF THE ELEMENT WAS NEVER BLESSED — somebody who
     loaded the wall and never touched it has given no gesture, and iOS
     refuses. That is caught and ignored: no music is a small loss, an
     unhandled rejection on the wall is not. AudioUnlock in the root
     layout blesses on the first tap anywhere, so in practice anyone who
     has interacted at all will hear it. */
  useEffect(() => {
    if (!drop || drop.is_out || !drop.release_at) return;
    const key = `droplobby:${drop.post_id}`;
    const lead = new Date(drop.release_at) - Date.now() - 60_000;
    if (lead > 86_400_000) return;          // same setTimeout ceiling as above
    let ramp = null;
    const start = async () => {
      try {
        await playShared(key, '/lobby.mp3', { loop: true });
        const a = sharedEl();
        a.volume = 0;
        const t0 = Date.now();
        ramp = setInterval(() => {
          const p = Math.min(1, (Date.now() - t0) / 3000);
          a.volume = p * 0.55;              // never full — it sits UNDER the moment
          if (p >= 1) { clearInterval(ramp); ramp = null; }
        }, 60);
      } catch {}
    };
    const t = setTimeout(start, Math.max(0, lead));
    return () => {
      clearTimeout(t);
      if (ramp) clearInterval(ramp);
      releaseShared(key);
    };
  }, [drop?.release_at, drop?.is_out, drop?.post_id]);

  /* 🔴 AND IT STOPS DEAD THE INSTANT THE RECORD STARTS. Two things playing
     over each other would ruin the one moment this whole feature exists
     for. ⚠️ release(), never a pause left owning the floor — see the note
     at the bottom of lib/song-audio.js about why releasing is not
     closing. */
  useEffect(() => {
    if (on && drop) releaseShared(`droplobby:${drop.post_id}`);
  }, [on, drop?.post_id]);

  if (!drop) return null;

  /* ⚠️ EVERYTHING BELOW THIS LINE RENDERS THE FRESHEST ROW. Destructured
     parameters are assignable, and reassigning here is deliberate: the
     alternative is renaming `drop` and `mediaUrl` at ~30 call sites in
     the markup below, which is a much larger change to make at the end of
     a long day for the same result. The two hooks that schedule against
     release_at ran above and correctly used the ORIGINAL row — a stale
     row still carries the right release time. */
  if (fresh) drop = fresh;
  if (freshUrl) mediaUrl = freshUrl;

  async function remindMe() {
    if (reminded || arming) return;
    setArming(true);
    setReminded(true);            // optimistic, like dismiss and unlike block
    const { error } = await browserClient()
      .rpc('drop_remind_me', { p_post_id: drop.post_id });
    /* ⚠️ Put back on failure. The whole promise of this link is that it
       arrives — a link that says "we'll tell you" when nothing was
       written is the one failure it cannot have. */
    if (error) setReminded(false);
    setArming(false);
  }

  /* ---------- 1 · COMING ---------- */
  if (!drop.is_out) {
    const p = parts(left);
    return (
      <article className="dp dp-soon">
        {/* ⭐ THE COVER ART, WHILE YOU WAIT — 3 Sept. Ty: "we wanna allow
            the artist to upload their cover art as well, so that would be
            the teaser."

            He was right, and it was worse than missing. The sheet has
            collected artwork since the day drops shipped (PhotoUpload
            kind="dropart" → art_path) and this card rendered NO image at
            all until the record was out. So an artist uploaded a cover
            and it did nothing during the exact window it exists for.
            This is YouTube's trailer slot, sitting empty with the asset
            already in the building.

            ⚠️ NO DATABASE CHANGE WAS NEEDED, and that is worth recording:
            feed_drops returns `art_path` UNCONDITIONALLY — only
            media_path and external_url are withheld before release — and
            lib/drops.js already signs it alongside the audio. The data
            was always here. Only the markup was missing.

            🔴 The frame is rendered ONLY when there is art. An artist who
            skipped the picture would otherwise get a full-width black
            square of nothing above their countdown, which is worse than
            the compact card they have today. Absence stays absent. */}
        {artUrl && (
          <div className="dp-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dp-art" src={artUrl} alt="" />
          </div>
        )}
        <span className="dp-dots" aria-hidden="true" />
        <div className="dp-in">
          {/* 🔴 "SOBER BOOK FIRST" IS A CLAIM, AND IT IS ONLY TRUE WHEN AN
              EXCLUSIVE WAS ACTUALLY CLAIMED.

              Ty caught this the first time a real card went up: it said
              "Sober Book first" over a song that came out on Friday. The
              card was making a promise on the artist's behalf that wasn't
              theirs to make — the same category as the "verified, real
              people" line that was killed off the landing page, and worse
              here, because the person it misrepresents is a member.

              exclusive_hours is NULLABLE precisely so a drop of something
              already public can have the poster without the claim. This
              line just has to respect it. */}
          <div className="dp-kicker">
            {drop.exclusive_hours ? 'Sober Book first' : 'New release'}
          </div>
          <h3 className="dp-title">{drop.title}</h3>
          <div className="dp-artist">{drop.artist}</div>

          <div className="dp-clock">
            <div className="dp-clabel">Opens in</div>
            <div className="dp-nums">
              {p.d > 0 && <span><b>{p.d}</b><i>d</i></span>}
              <span><b>{String(p.h).padStart(2, '0')}</b><i>h</i></span>
              <span><b>{String(p.m).padStart(2, '0')}</b><i>m</i></span>
              {/* Seconds only inside the last hour — a seconds counter on a
                  three-day wait is a nervous tic, not information. */}
              {p.d === 0 && p.h === 0 && <span><b>{String(p.s).padStart(2, '0')}</b><i>s</i></span>}
            </div>
            <div className="dp-when">{when(drop.release_at)}</div>
          </div>

          {/* ⭐ "Notify me when it plays" — Ty's words, and his call that
              this is a LINK rather than the button the prototype also had.
              He saw both and cut it to one.

              ⚠️ OPT-IN, PER RECORD, AND THAT IS WHAT KEEPS THE PROMISE.
              The push card tells members "replies and messages only,
              nothing else, ever." Nothing arrives from this unless the
              person taps it, about this one record. YouTube's reminder
              works the same way — that's where the shape came from.

              🔴 ONE notification, at open. YouTube also buzzes about
              thirty minutes early; we deliberately don't. The link says
              "when it plays" and that is exactly what it does. */}
          <button type="button" className="dp-remind"
                  data-on={reminded ? '1' : undefined}
                  disabled={!!reminded || arming}
                  onClick={remindMe}>
            {reminded ? 'We’ll tell you when it plays' : 'Notify me when it plays'}
          </button>
        </div>
      </article>
    );
  }

  /* ---------- 2 & 3 · OUT ---------- */
  const isVideo = drop.kind === 'video';

  /* 🔴 A PLAY BUTTON OVER A RECORD WITH NOTHING TO PLAY — 3 Sept.
     ---------------------------------------------------------------------
     Ty: "why can't I click and listen to Jordan Cruz's song." Because
     there is no song here. `media_path` is NULL on that drop — he posted
     it as a Spotify link, not an upload. Nothing was ever wrong with the
     audio.

     🔴 The button was already `disabled={!mediaUrl}`, and that did almost
     nothing: the ONLY style on `.dp-play:disabled` is `cursor:default`.
     A phone has no cursor. So a dead play button and a live one were the
     same pixels, and the tap just failed in silence.

     ⭐ THE FIX IS NOT TO REMOVE THE BUTTON — it is to make it go where the
     record actually lives. A link-only drop still has somewhere to send
     you, and sending you there is what the person tapping wanted.

     ⚠️ IT NAMES THE DESTINATION. House rule for every outbound link on
     this wall (23 Aug): in a room where treatment centres pay for
     referrals, an unlabelled link is how somebody gets sold. `no-referrer`
     for the same reason — elsewhere a referrer is a statistic, here it
     tells a stranger's logs that the visitor is in recovery.

     ⚠️ The face is built ONCE and used by both branches. Writing the art,
     the dots and the exclusive badge twice is how the two paths drift —
     the mistake this schema has already made three times. */
  const SERVICES = [
    { host: 'spotify.com',    name: 'Spotify',     tint: '#1DB954' },
    { host: 'music.apple.com', name: 'Apple Music', tint: '#FA243C' },
    { host: 'youtube.com',    name: 'YouTube',     tint: '#FF0000' },
    { host: 'youtu.be',       name: 'YouTube',     tint: '#FF0000' },
    { host: 'soundcloud.com', name: 'SoundCloud',  tint: '#FF5500' },
    { host: 'bandcamp.com',   name: 'Bandcamp',    tint: '#629AA9' },
  ];
  function whereItLives(url) {
    try {
      const h = new URL(url).hostname.replace(/^www\./, '');
      return SERVICES.find((s) => h === s.host || h.endsWith('.' + s.host))
             || { name: h, tint: null };
    } catch { return null; }
  }
  const out = !mediaUrl && drop.external_url ? whereItLives(drop.external_url) : null;

  const face = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {artUrl
        ? <img className="dp-art" src={artUrl} alt="" />
        : <span className="dp-art dp-noart" aria-hidden="true" />}
      <span className="dp-dots" aria-hidden="true" />

      {/* ⚠️ Rendered from is_exclusive_now, which the DATABASE
          computes. Doing this arithmetic in the browser would put
          the promise at the mercy of a phone with the wrong clock. */}
      {drop.is_exclusive_now && (
        <span className="dp-only">
          Only here · {parts(winLeft).d > 0
            ? `${parts(winLeft).d}d left`
            : `${parts(winLeft).h}h left`}
        </span>
      )}

      <span className="dp-btn"
            style={out && out.tint ? { background: out.tint } : undefined}
            aria-hidden="true">
        <span className="dp-tri"
              style={out && out.tint ? { borderLeftColor: '#FFFFFF' } : undefined} />
      </span>
    </>
  );

  return (
    <article className="dp">
      <div className="dp-frame">
        {on && mediaUrl ? (
          isVideo
            ? <video className="dp-media" src={mediaUrl} controls autoPlay playsInline />
            : <audio className="dp-audio" src={mediaUrl} controls autoPlay />
        ) : out ? (
          <a className="dp-play" href={drop.external_url} target="_blank"
             rel="noopener noreferrer" referrerPolicy="no-referrer"
             aria-label={`Play ${drop.title} by ${drop.artist} on ${out.name}`}>
            {face}
          </a>
        ) : (
          <button type="button" className="dp-play"
                  onClick={() => setOn(true)}
                  disabled={!mediaUrl}
                  aria-label={`Play ${drop.title} by ${drop.artist}`}>
            {face}
          </button>
        )}
      </div>

      <div className="dp-in">
        <h3 className="dp-title dp-out">{drop.title}</h3>
        <div className="dp-artist">{drop.artist}</div>

        {/* Only ever present once the window has shut — the view returns
            NULL for external_url while the exclusive is running.
            ⚠️ When there's nothing to play here, this line stops being a
            footnote and becomes the instruction, so it says where. */}
        {drop.external_url && (
          <a className="dp-link" href={drop.external_url} target="_blank"
             rel="noopener noreferrer" referrerPolicy="no-referrer">
            {out ? `Play on ${out.name} ↗` : 'Also out everywhere ↗'}
          </a>
        )}
      </div>
    </article>
  );
}
