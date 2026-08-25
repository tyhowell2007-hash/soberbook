'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/* =====================================================================
   SOMETHING TO WATCH, ON THE WALL.

   Aug 23, second pass. Ty: "lets make the box the player sits in more
   premium!!"

   ---------------------------------------------------------------------
   ⭐ WHAT PREMIUM MEANS HERE, BECAUSE IT ISN'T "LOUDER".

   This card has to stay QUIETER than a member's post — a person's words
   are the point of this page and a video is what you pass on the way to
   them. So none of the usual volume knobs were available: no bigger type
   than a post, no acid edge, no colour fighting the green room.

   What's left is the stuff that actually reads as expensive:
     · the title sits ON the picture over a gradient, not stranded under
       it in a paragraph. One object instead of three stacked ones.
     · a real layered shadow instead of a hard border
     · the source as a byline in small caps, the way a masthead does it
     · a glass play button rather than a grey circle
     · it presses when you touch it

   ⚠️ It is the only rounded thing in the app, and that is deliberate
   rather than sloppy: the whole of Sober Book has three border-radius
   declarations, because square is the house style. A piece of media from
   somewhere else is not a Sober Book object and shouldn't pretend to be —
   the rounding is what says "this came from outside".

   ---------------------------------------------------------------------
   🔴 NOTHING LOADS UNTIL SOMEBODY TAPS PLAY. Third place this rule
   applies, after Linked.jsx and SongPlayer.jsx. An iframe fires the
   instant the page renders, so a wall carrying seven of these would
   announce this member's browser to Google seven times before they
   touched anything.

   ⚠️ And the picture comes from OUR bucket, not i.ytimg.com — that is the
   whole reason the puller downloads and re-encodes it. A picture is a
   request too. Getting the iframe right and leaving the image pointing at
   Google would leak the same thing, quietly, on every page load.

   ⚠️ THE SOURCE IS ALWAYS ON THE CARD. In a room where treatment centres
   pay for referrals, somebody has to see whose voice this is before they
   tap. Curating it ourselves makes that more of an obligation, not less.
   ===================================================================== */

const CHIP = {
  comedy:   'comedy',
  music:    'music',
  recovery: 'recovery',
  calm:     'calm',
  local:    'ohio',
  talk:     'talk',
};

export default function ContentCard({ item, thumbBase, canHide = false }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  /* null | 'asking' | 'busy' | 'gone' */
  const [menu, setMenu] = useState(null);
  if (!item) return null;

  /* 🔴 THE HANDLE ON A SWITCH THAT ALREADY EXISTED.

     `hidden_at` and `active` have been in the schema since 0057. Ty took
     Rogan and Kratom on auto-pull knowing whatever they upload next lands
     unreviewed — and there was no way to pull anything down. Sixth time
     this month something was fully built with no way in.

     ⚠️ Only Ty sees this. Members hiding things for everyone is a
     different feature with different consequences; letting one person
     curate the room for five others needs a conversation, not a button. */
  async function hide(scope) {
    setMenu('busy');
    try {
      const r = await fetch('/api/content/hide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scope === 'source' ? item.source_id : item.id, scope }),
      });
      if (!r.ok) throw new Error();
      setMenu('gone');
      /* Refresh so the rest of that source's cards go too — hiding one
         video and leaving five more from the same channel on screen would
         read as the button not working. */
      router.refresh();
    } catch { setMenu('asking'); }
  }

  const thumb = item.thumb_path ? `${thumbBase}/${item.thumb_path}` : null;

  /* ---- a flyer, not a video (0071) ----

     🔴 WITHOUT THIS, A FLYER RENDERED A PLAY BUTTON THAT DID NOTHING.
     The card's whole structure is `on && embed_id ? <iframe> : <play>`, so
     an item with no embed_id showed the button, set on=true when tapped,
     failed the second half of the condition, and drew the button again.
     A control that visibly does nothing, forever.

     ⚠️ An event also carries things a podcast episode never does — a date
     and a place — and both matter before somebody decides to go. Goodale
     Park is two hours from Cadiz. */
  const isFlyer = !item.embed_id;
  const when = item.event_at ? new Date(item.event_at) : null;

  if (isFlyer) {
    return (
      <article className="cc ccflyer">
        <a href={item.url} target="_blank" rel="noopener noreferrer"
           /* ⚠️ no-referrer, same as every outbound link here: elsewhere
              the referrer is a statistic, here it tells a stranger's logs
              that the visitor is in recovery. */
           referrerPolicy="no-referrer" className="ccflyerlink">
          {thumb && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="ccflyerimg" src={thumb} alt={item.title} loading="lazy" />
          )}
          <span className="ccmeta ccflyermeta">
            <span className="ccsrc">{item.source_label}</span>
            {when && (
              <span className="cccat">
                {when.toLocaleDateString(undefined,
                  { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            )}
          </span>
        </a>
        <p className="ccbelow">{item.title}</p>
        {item.place && <p className="ccplace">{item.place}</p>}
        {canHide && (
          <div className="cchide">
            {menu === 'asking' ? (
              <>
                <button type="button" onClick={() => hide('item')}>Hide this one</button>
                <button type="button" onClick={() => hide('source')}>Stop {item.source_label}</button>
                <button type="button" className="ccx" onClick={() => setMenu(null)}>Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setMenu('asking')} disabled={menu === 'busy'}>
                {menu === 'busy' ? 'Taking it down…' : 'Take this down'}
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  /* ⚠️ Says what happened rather than vanishing. A card that silently
     disappears on tap leaves you unsure whether you hit the right thing —
     and this is the control that has to feel reliable, because it's the
     one used when something has gone wrong. */
  if (menu === 'gone') {
    return (
      <article className="cc cc-gone">
        <p className="ccgone">Taken down. It won&apos;t come back on the next pull.</p>
      </article>
    );
  }

  return (
    <article className="cc">
      <div className="ccframe">
        {on && item.embed_id ? (
          <iframe
            className="ccif"
            src={`https://www.youtube-nocookie.com/embed/${item.embed_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={item.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            /* ⚠️ Not no-referrer — YouTube refuses an embed that arrives
               with no origin at all. This is the tightest they accept:
               they learn the site, never the page or the member. */
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          /* ⚠️ ONE button, and everything readable is inside it. Nothing in
             here is a link — an <a> inside a <button> is invalid HTML — so
             "watch on youtube" lives below the frame. */
          <button type="button" className="ccplay"
                  onClick={() => setOn(true)}
                  aria-label={`Play ${item.title}, from ${item.source_label}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumb
              ? <img className="ccimg" src={thumb} alt="" loading="lazy" />
              : <span className="ccimg ccnone" aria-hidden="true" />}

            {/* The gradient is what makes white text on an unknown photo
                safe. ⚠️ Without it the title is legible on a dark
                thumbnail and invisible on a bright one, and we do not get
                to choose the thumbnail. */}
            <span className="ccscrim" aria-hidden="true" />

            <span className="ccmeta">
              <span className="ccsrc">{item.source_label}</span>
              <span className="cccat">{CHIP[item.category] || item.category}</span>
            </span>

            <span className="ccbtn" aria-hidden="true"><span className="cctri" /></span>

            <span className="cctitle">{item.title}</span>
            <span className="ccnote">nothing loads until you tap</span>
          </button>
        )}
      </div>

      {/* Once it's playing the title has nowhere to sit on the picture,
          so it comes back out underneath. */}
      {on && <p className="ccbelow">{item.title}</p>}

      {canHide && (
        <div className="cchide">
          {menu === 'asking' ? (
            <>
              <button type="button" onClick={() => hide('item')}>Hide this one</button>
              <button type="button" onClick={() => hide('source')}>
                Stop {item.source_label}
              </button>
              <button type="button" className="ccx" onClick={() => setMenu(null)}>Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setMenu('asking')}
                    disabled={menu === 'busy'}>
              {menu === 'busy' ? 'Taking it down…' : 'Take this down'}
            </button>
          )}
        </div>
      )}

      {/* ⚠️ no-referrer on the way OUT, unlike the embed above — leaving
          has no such constraint, so it gets the strict rule the rest of
          the app uses for links a member might follow. */}
      <a className="ccout" href={item.url} target="_blank"
         rel="noopener noreferrer" referrerPolicy="no-referrer">
        watch on youtube ↗
      </a>
    </article>
  );
}
