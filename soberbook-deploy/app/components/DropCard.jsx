'use client';

import { useEffect, useState } from 'react';

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
  const left    = useCountdown(drop && !drop.is_out ? drop.release_at : null);
  const winLeft = useCountdown(drop && drop.is_exclusive_now ? drop.exclusive_until : null);

  if (!drop) return null;

  /* ---------- 1 · COMING ---------- */
  if (!drop.is_out) {
    const p = parts(left);
    return (
      <article className="dp dp-soon">
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
        </div>
      </article>
    );
  }

  /* ---------- 2 & 3 · OUT ---------- */
  const isVideo = drop.kind === 'video';
  return (
    <article className="dp">
      <div className="dp-frame">
        {on && mediaUrl ? (
          isVideo
            ? <video className="dp-media" src={mediaUrl} controls autoPlay playsInline />
            : <audio className="dp-audio" src={mediaUrl} controls autoPlay />
        ) : (
          <button type="button" className="dp-play"
                  onClick={() => setOn(true)}
                  disabled={!mediaUrl}
                  aria-label={`Play ${drop.title} by ${drop.artist}`}>
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

            <span className="dp-btn" aria-hidden="true"><span className="dp-tri" /></span>
          </button>
        )}
      </div>

      <div className="dp-in">
        <h3 className="dp-title dp-out">{drop.title}</h3>
        <div className="dp-artist">{drop.artist}</div>

        {/* Only ever present once the window has shut — the view returns
            NULL for external_url while the exclusive is running. */}
        {drop.external_url && (
          <a className="dp-link" href={drop.external_url} target="_blank"
             rel="noopener noreferrer" referrerPolicy="no-referrer">
            Also out everywhere ↗
          </a>
        )}
      </div>
    </article>
  );
}
