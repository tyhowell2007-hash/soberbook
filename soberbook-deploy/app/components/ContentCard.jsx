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

export default function ContentCard({ item, thumbBase, canHide = false, pinned = false }) {
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

  /* ⭐ A LEADING SLASH MEANS "WE MADE THIS OURSELVES".

     Every YouTube thumbnail is copied into our Supabase bucket, because
     rendering one from i.ytimg.com makes a member's browser call Google
     just by scrolling. A picture is a request too.

     A card image we DREW — like the OCAAR one — is already sitting in
     this app's own public/ folder. Serving it from there is our own
     origin: no third party, nothing to leak, and no upload step. So a
     thumb_path starting with / is used as-is.

     ⚠️ This is not a hole in the no-hotlinking rule. It only matches
     paths beginning with a slash, which cannot name another host — an
     absolute URL like https://evil.example/x.jpg starts with 'h' and
     falls through to being treated as a bucket key, where it 404s. */
  const ourArt = !!item.thumb_path && item.thumb_path.startsWith('/');
  const thumb = !item.thumb_path ? null
    : ourArt ? item.thumb_path
    : `${thumbBase}/${item.thumb_path}`;

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
    /* 🔴 A CARD BUILT AROUND A PICTURE, WITH NO PICTURE, IS A 102px
       SLIVER. That is exactly what shipped: the link wrapped only the
       source label, so the area a thumb naturally goes for was empty and
       the title underneath was not a link at all.

       ⭐ So the whole card is the link, and it works with or without a
       flyer. An item with no image gets a text card that still reads like
       something you can tap; an item with one gets the poster. */
    return (
      <article className={'cc ccflyer' + (thumb ? '' : ' ccnoimg') + (pinned ? ' ccpin' : '')}>
        {/* ⚠️ The pin SAYS it is pinned. A thing sitting above everybody's
            posts with no explanation reads as the feed being broken or as
            an ad that snuck in. One word, in small caps, and it is the
            same word Ty would use. */}
        {pinned && <p className="ccpinlabel">Pinned by Sober Book</p>}
        <a href={item.url} target="_blank" rel="noopener noreferrer"
           /* ⚠️ no-referrer, same as every outbound link here: elsewhere
              the referrer is a statistic, here it tells a stranger's logs
              that the visitor is in recovery. */
           referrerPolicy="no-referrer" className="ccflyerlink">
          {thumb ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ccflyerimg" src={thumb} alt={item.title} loading="lazy" />
              {/* 🔴 THE OVERLAY IS SKIPPED ON ARTWORK WE MADE OURSELVES.

                  It prints the source and the date over the top-left and
                  top-right of the picture. On a flyer somebody emailed us
                  that is the only thing saying who it's from. On a card we
                  drew, the name is already set 56px on an acid slab — so
                  the overlay stamped a second faint "OCAAR" over the first
                  one, and dropped the date chip in the top-right corner,
                  which is exactly where the QR code is.

                  ⚠️ A label sitting on a QR is not cosmetic. Scanners need
                  the quiet zone and the finder pattern clean; that chip
                  covers one of the three corner squares. It looked like a
                  design nit and it was a broken scan.

                  Same test as the image source: a leading slash means we
                  drew it, so it already carries its own branding. */}
              {!ourArt && (
                <span className="ccmeta ccflyermeta">
                  <span className="ccsrc">{item.source_label}</span>
                  {when && (
                    <span className="cccat">
                      {when.toLocaleDateString(undefined,
                        { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </span>
              )}
            </>
          ) : (
            /* No flyer: a plain, obviously-tappable card. ⚠️ The source and
               date move INTO the flow rather than floating over an image
               that isn't there. */
            <span className="ccnoimgtop">
              <span className="ccsrc">{item.source_label}</span>
              {when && (
                <span className="cccat">
                  {when.toLocaleDateString(undefined,
                    { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
            </span>
          )}
          <span className="ccflyertitle">{item.title}</span>
          {item.place && <span className="ccplace">{item.place}</span>}
        </a>

        {/* =================================================================
            THE BUTTON, AND IT IS DELIBERATELY OUTSIDE THE LINK ABOVE.

            🔴 An <a> inside an <a> is invalid HTML. Browsers don't error —
            they silently un-nest it, and you get a button that is somewhere
            other than where you wrote it, working on desktop and not on a
            phone. Same rule the reply preview follows on the wall.

            ⭐ Why a real button and not the "opens facebook.com ↗" hint this
            replaces: the whole card being tappable is invisible. A poster
            looks like a picture, and nobody taps a picture expecting to
            leave. Ty, Aug 26: "a button that takes you to their website."
            Seventh instance this month of everything-built-except-the-way-in.

            ⚠️ The domain is always shown. In a room where treatment centres
            pay for referrals, an unlabelled outbound link is how somebody
            gets sold to without knowing it.

            ⚠️ no-referrer, like every outbound link here — elsewhere a
            referrer is a statistic; here it tells a stranger's server logs
            that the visitor is in recovery. */}
        {(() => {
          let host = null;
          try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
          if (!host) return null;
          const label = /facebook\.com$/.test(host) ? 'Find them on Facebook'
                      : /instagram\.com$/.test(host) ? 'Find them on Instagram'
                      : 'Go to their website';
          return (
            <a className="ccbtn" href={item.url} target="_blank"
               rel="noopener noreferrer" referrerPolicy="no-referrer">
              <span className="ccbtnlabel">{label} →</span>
              <span className="ccbtnhost">{host}</span>
            </a>
          );
        })()}
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
