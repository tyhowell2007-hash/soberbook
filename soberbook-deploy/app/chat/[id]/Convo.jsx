'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';
import RowMenu from '../../friends/RowMenu';
/* ⚠️ THE SAME TWO COMPONENTS THE ROOM USES, not copies. PhotoUpload is
   the one quarantine road and the one metadata strip; EmojiPicker is the
   one list. A chat-only version of either would be a second
   implementation of something that already works, and the second copy is
   the one that drifts — the lesson 0046 → 0049 taught three times. */
import PhotoUpload from '../../components/PhotoUpload';
import { Body } from '../../components/Linked';
import { useTagBox, useTaggablePeople } from '../../components/TagBox';
import EmojiPicker from '../../friends/EmojiPicker';
import Shot from '../../components/Shot';

/* =====================================================================
   ONE CONVERSATION.

   Polls every 8 seconds. Not websockets — Supabase Realtime would be the
   grown-up answer and it's maybe forty lines, but it publishes changes
   from a table, and the table is `messages`, which is the one thing in
   this app members are not allowed to read. Wiring realtime correctly
   means proving the publication respects the same filtering the view
   does, and that is a session of its own. Eight seconds is unglamorous
   and it cannot leak.

   ⚠️ THERE IS NO TYPING INDICATOR AND NO "SEEN" TICK, and that isn't an
   omission. Both broadcast that you opened the app, which for somebody
   avoiding an ex, a dealer, or a family member is a location ping in a
   different costume. Read state is stored — you need it for the badge —
   but only your own side is ever shown to you.
   ===================================================================== */

export default function Convo({ thread, initial }) {
  const [msgs, setMsgs] = useState(initial);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const foot = useRef(null);
  const inputRef = useRef(null);
  /* 14 Sept — the spacer now measures the thing it clears. See the note on
     the effect below; these two are what make that possible. */
  const dockRef = useRef(null);
  const padRef = useRef(null);

  /* Photos staged but not sent yet, and the signed links for photos
     already in the conversation. */
  const [tray, setTray] = useState([]);
  /* One video, or none — its own slot, same as the room. */
  const [vid, setVid] = useState(null);
  const [upBusy, setUpBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [urls, setUrls] = useState({});

  /* ---- tagging in a message (5 Sept) ----
     ⚠️ DECLARED AFTER inputRef ON PURPOSE. `const` is hoisted but not
     initialised, so a hook that reads inputRef from above it throws
     "Cannot access before initialization" and white-screens the page —
     which is exactly what happened in Room.jsx an hour before this was
     written, with a green build the whole time.

     🔴 THE MENU AND THE LINK, AND DELIBERATELY NO NOTIFICATION. The
     person you are talking to already gets a 'message' notification, so
     the only NEW person an @ can name here is a third party outside the
     conversation — and telling them "two people mentioned you in a
     private conversation" publishes the existence of a private
     conversation about them. 0131 has no 'chat' branch for the same
     reason. There is no tellThemTheyWereTagged() call in this file and
     there must not be one. */
  const people = useTaggablePeople();
  const tag = useTagBox({ text: body, setText: setBody, boxRef: inputRef, people });
  const urlsRef = useRef({});
  useEffect(() => { urlsRef.current = urls; }, [urls]);

  /* ⚠️ THE BUCKET IS PRIVATE, so a stored path has no working URL of its
     own. This asks our own route, which asks `chat_messages` whether the
     caller may see each path and signs only what comes back. The rule has
     ONE home and it is not in this file.

     ⚠️ Only paths we don't already hold. A signed URL is cached in
     Postgres and reused; asking again for one we have would cost a round
     trip for an answer we already know. On 26 Aug the equivalent mistake
     on the Wall burned 159% of the egress tier in a month. */
  async function signMissing(rows) {
    const have = urlsRef.current;
    const want = [];
    for (const m of rows) {
      for (const p of m.photo_urls || []) if (p && !have[p]) want.push(p);
      /* 🔴 The video too. A path nobody asks to sign never gets a URL,
         and the player renders empty with no error anywhere. */
      if (m.video_url && !have[m.video_url]) want.push(m.video_url);
    }
    if (!want.length) return;
    try {
      const res = await fetch('/api/photo/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [...new Set(want)] }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.urls) setUrls((u) => ({ ...u, ...d.urls }));
    } catch {
      /* A picture that can't be signed simply doesn't render. The
         conversation still works — the same "fail to no-photos rather
         than to a broken page" stance signPhotoPaths itself takes. */
    }
  }

  useEffect(() => { signMissing(msgs); }, [msgs]);

  /* ⚠️ Local copy DELETED — tag.insertEmoji owns the caret. 0049's
     rule: remove a copy, never keep two. */
  const insertEmoji = tag.insertEmoji;

  /* 🔴 'sent' means A MESSAGE IS ALREADY OUT and they haven't answered.
     It does NOT mean "you opened this thread" — that's 'new', and the box
     must be live for it.

     This line was right; the view feeding it was wrong (0046). Tapping
     Message created the thread, the view said 'sent' with zero messages
     sent, and the box was dead before anybody typed a word. Ty found it:
     "Every time I try to chat with somebody, I can't."

     ⚠️ If a state ever shows up here that isn't in this list, the box
     stays LIVE. Failing open is right for a message box and wrong almost
     everywhere else in this app — the database refuses what it must
     refuse, so the worst case is a rejected send, while failing shut is
     a person silently unable to speak. */
  const waiting = thread.state === 'sent';

  /* 🔴 10 Sept — A CONVERSATION OPENED 170px SHORT OF THE BOTTOM, which put
     the newest message 117px BEHIND the composer. Measured on the live app:
     document.elementFromPoint at that message's centre returned the nav tab,
     not the message. So the last thing somebody said to you was covered by
     the box you answer in, and the only way out was to know to scroll down
     in a conversation that already looked like it had ended.

     ⭐ THE LAYOUT WAS NEVER WRONG. Scrolled to the true bottom, the last
     bubble clears the composer by 53px — proven both ways before a line was
     changed. Only the scroll was wrong.

     THE CAUSE: ref={foot} sits ABOVE .convopad, and .convopad is the 76px
     spacer whose entire job is clearing the fixed bar and the tab bar under
     it. Aligning foot's end to the viewport bottom therefore stops one whole
     spacer short, every time, by construction.

     ⚠️ Scrolling the document to its real bottom is deterministic. Aligning
     to an element is a guess about WHICH element, and that guess is what
     broke. `foot` is left in place as a marker, but nothing scrolls to it.

     ⚠️ And it runs three times — now, after paint, and again at 300ms —
     because a photo that finishes loading after the first pass grows the
     page underneath you and puts the newest message back under the box. */
  useEffect(() => {
    const toBottom = () => {
      /* ⚠️ Size the spacer BEFORE scrolling, never after. Scrolling to a
         bottom that is about to move is how the newest message ends up
         behind the composer by exactly the amount the pad was wrong. */
      fitPad();
      const se = document.scrollingElement || document.documentElement;
      se.scrollTop = se.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const late = setTimeout(toBottom, 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(late); };
  }, [msgs.length]);

  /* 🔴 14 SEPT — .convopad WAS A NUMBER WRITTEN DOWN, AND IT WAS THE
     SAME MISTAKE THIS FILE'S OWN STYLESHEET WAS BUILT TO DELETE.

     app/convo.css says of the old inbox.css rule: "68px is the bar's
     height WRITTEN DOWN. That number moves with the font size, the
     safe-area inset and whether the error line is showing. It is the
     exact failure the dock exists to remove." Then `.convopad{height:76px}`
     sat one file away doing precisely that, for the same bar.

     MEASURED ON THE LIVE PAGE before this was written:
       composer at rest .... furniture 158px, page reserves 170px → 12px spare
       three lines typed ... furniture 232px, page reserves 170px → 62px SHORT
       six lines typed ..... furniture 322px, page reserves 170px → 152px SHORT
     At three lines the newest bubble was fully behind the composer —
     document.elementFromPoint at its centre returned `.cbar`, not the
     bubble, which is the same proof the 10 Sept scroll bug was caught by.

     🔴🔴 MY FIRST VERSION OF THIS WAS WRONG AND IT SHIPPED FOR ABOUT TEN
     MINUTES. It derived the answer from `se.scrollHeight`, and
     scrollHeight is CLAMPED TO THE VIEWPORT — on a short conversation it
     equals clientHeight, so the "space already reserved below the last
     message" came out enormous and the pad collapsed to 0. Measured live:
     the newest bubble went from 21px of clearance to 55px BEHIND the
     composer. ⭐ The fix I wrote was worse than the bug I was fixing, and
     the only reason that is a ten-minute story instead of a three-day one
     is that the page was measured after deploying instead of reasoned
     about. A formula that is right on a long page and wrong on a short one
     is not a formula, it is a coincidence with good manners.

     ⭐ THE REAL FORMULA IS STRUCTURAL, AND IT NEVER ASKS HOW TALL THE PAGE
     IS. Reserve the dock's own height, plus whatever sits between the dock
     and the bottom of the screen that the nav spacer does NOT already
     cover (that difference is the iPhone home-indicator inset), plus the
     gap, minus the padding .convo already carries. Four live reads, no
     constants except GAP. Sanity check: at rest it computes exactly 76px —
     the value that had been hand-tuned into the CSS — and unlike that 76
     it now moves when the bar does.

     ⚠️ GAP is the only constant, and it is a deliberate visual gap
     between the newest message and the box you answer in — not a fudge
     factor covering a measurement.

     ⚠️ Re-pins to the bottom ONLY if you were already there. Growing the
     pad while somebody is scrolled up reading history and yanking them
     to the end would be a worse bug than the one this fixes.

     ⚠️ No ResizeObserver loop: this writes the PAD's height, and the pad
     is not inside the dock, so the dock cannot resize in response. */
  /* 🔴 DELIBERATELY NOT ONLY A ResizeObserver, AND THE REASON IS A CHECK
     THAT COULD NOT FIRE. Trying to verify the first version, neither the
     app's observer NOR a fresh one created by hand fired at all — because
     `document.hidden` was true, and a hidden tab produces no frames, so
     no ResizeObserver callback and no requestAnimationFrame are ever
     delivered. (Four separate times in this project a backgrounded tab
     has been mistaken for a broken feature.) ⭐ That is only a testing
     problem, but it pointed at a real one: making the layout depend on a
     callback that the browser is free to withhold means the pad can sit
     stale, and nothing says so.

     So `fitPad` is called DIRECTLY at the two moments that actually
     matter — a message arriving, and the box growing under your fingers —
     and the observer is kept only as a backstop for everything else (a
     photo staged into the tray, an error line appearing, the keyboard
     opening). Direct calls run synchronously in the event that caused
     them, so they work in any tab state and can be measured. */
  function fitPad() {
    const dock = dockRef.current;
    const pad = padRef.current;
    const conv = document.querySelector('.convo');
    if (!dock || !pad || !conv) return;
    const GAP = 12;
    const se = document.scrollingElement || document.documentElement;
    const nav = document.querySelector('.navpad');
    const d = dock.getBoundingClientRect();
    const belowDock = window.innerHeight - d.bottom;
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const convPad = parseFloat(getComputedStyle(conv).paddingBottom) || 0;
    const want = Math.max(0, Math.ceil(d.height + (belowDock - navH) + GAP - convPad));
    const wasAtBottom = se.scrollHeight - se.clientHeight - se.scrollTop < 60;
    if (want !== pad.offsetHeight) pad.style.height = want + 'px';
    if (wasAtBottom) se.scrollTop = se.scrollHeight;
  }

  useEffect(() => {
    fitPad();
    if (typeof ResizeObserver === 'undefined' || !dockRef.current) return;
    const ro = new ResizeObserver(() => fitPad());
    ro.observe(dockRef.current);
    const onResize = () => fitPad();
    window.addEventListener('resize', onResize);
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); };
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    const supabase = browserClient();
    let alive = true;

    async function pull() {
      const { data } = await supabase.from('chat_messages')
        .select('*').eq('thread_id', thread.id)
        .order('created_at', { ascending: true }).limit(200);
      if (alive && data) setMsgs(data);
      await supabase.rpc('mark_thread_read', { t_id: thread.id });

      /* 🔴 AND THE NOTIFICATION FOR THIS THREAD — 3 Sept.
         `mark_thread_read` above marks the MESSAGES read and has never
         touched `notifications`. Nothing else did either, so the only way
         to put the Chat dot out was the blanket
         `notifications_mark_read('message')` the inbox used to run on
         mount — which wiped every thread's notification the moment you
         glanced at the list. Ty had 133 threads and had never seen one.

         ⭐ This is the surface that displayed the CONTENTS, so this is the
         surface allowed to clear it. One thread, this thread, no others.
         ⚠️ It sits AFTER the fetch on purpose: clear what you just showed
         somebody, not what you are about to. */
      await supabase.rpc('notifications_mark_thread_read', { t_id: thread.id });
    }

    pull();
    const t = setInterval(pull, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [thread.id]);

  async function send(e) {
    e.preventDefault();
    const text = body.trim();
    const paths = tray.map((t) => t.path);
    /* ⚠️ A PICTURE ON ITS OWN IS A MESSAGE (0128) — which is how most
       people send one. Requiring text here would have made the photo
       button feel broken for the commonest case. ⚠️ And never send while
       an upload is still in flight, or the path isn't in the tray yet and
       the picture is silently dropped from the message. */
    if ((!text && !paths.length) || busy || upBusy) return;
    setBusy(true); setErr('');

    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('messages')
      .insert({
        thread_id: thread.id,
        sender_id: user.id,
        /* null, not '' — the CHECK asks whether there are words, and an
           empty string would pass NOT NULL while meaning nothing. */
        body: text || null,
        photo_urls: paths.length ? paths : null,
        video_url: vid ? vid.path : null,
      });
    setBusy(false);

    /* The database refuses a second message to somebody who hasn't
       replied, and the refusal comes back as plain English written in the
       trigger. Show it as-is: it says nothing the sender doesn't already
       know, and rewording it here would risk saying more. */
    if (error) { setErr(error.message.replace(/^.*?:\s*/, '')); return; }

    /* ⚠️ 14 Sept — THE HEIGHT, NOT JUST THE TEXT. The box is sized by an
       inline style written only by onInput, and setBody('') does not fire
       onInput — so before this line, sending a three-line message left a
       three-line EMPTY composer standing over the conversation, and the
       bubble you had just sent was behind it. That is Nic's report:
       "you have to scroll up to see that first message you sent."
       ⭐ Wall.jsx has had this line since 12 Sept. This file and Room.jsx
       were written from the same pattern and both missed it. */
    setBody('');
    if (inputRef.current) inputRef.current.style.height = '';
    setTray([]); setVid(null);
    const { data } = await supabase.from('chat_messages')
      .select('*').eq('thread_id', thread.id)
      .order('created_at', { ascending: true }).limit(200);
    if (data) setMsgs(data);
  }

  return (
    <>
      {/* 🔴 30 AUG — THE ⋯ IS THE BUG FIX, AND IT IS A SAFETY CONTROL.

          Until today there was no way to block or report anybody from
          inside a conversation. The only route was: leave, open
          Community, scroll a list of ninety-eight people, find them,
          open their row menu. At eighteen members that was survivable.
          Migration 0087 removed the cap that stopped a stranger sending
          more than one message, and 0087's own comment said block and
          report had to become reachable from the row AND from in here or
          the migration should be reverted. Only half of it shipped.

          ⚠️ Eleventh "everything built except the way in" this month —
          delete-your-post, "Say hi", sign out, the content hide button —
          and the first one where the missing door is how you get away
          from somebody.

          ⭐ "their page ›" moved INTO the sheet rather than sitting
          beside the dots. Four things in a phone-width bar is how the
          ⋯ gets pushed off the edge by a long handle, and the sheet is
          where this app already puts per-person actions, so nobody has
          to learn a second gesture to protect themselves. */}
      <div className="mast">
        <Link href="/chat" className="back" aria-label="Back to chat">‹</Link>
        <span className="lg cvname">{thread.other_name}</span>
        <RowMenu
          handle={thread.other_handle}
          name={thread.other_name}
          primaryLabel="Their page"
          primaryHref={`/u/${thread.other_handle}`}
          afterBlock={() => { window.location.href = '/chat'; }}
        />
      </div>

      <div className="convo">
        {/* ⚠️ THIS SENTENCE USED TO BE A LIE AND NOBODY NOTICED FOR A DAY.

            It read "Say hello. They'll see it as a request first." —
            true until 0087 removed the request gate on 29 Aug, false
            from that moment, and shown on every empty conversation in
            the app. Same category as "verified, real people" on the
            landing page and the drop card that said "Sober Book first"
            over an already-released song: the app describing itself
            inaccurately to the person using it.

            🔴 The lesson is about the migration, not the copy. When a
            rule is removed from the database, the screens that EXPLAIN
            that rule are part of the change. 0087 shipped the behaviour
            and left its own description behind. */}
        {msgs.length === 0 && (
          <p className="cnote">Say hello.</p>
        )}
        {msgs.map((m) => {
          const pics = (m.photo_urls || []).filter(Boolean);
          return (
            <div key={m.id} className={'bub' + (m.is_mine ? ' mine' : '')}>
              {/* ⚠️ A picture that hasn't been signed yet renders as
                  NOTHING, not as a broken-image icon. urls[p] is undefined
                  until the round trip lands, and an <img> with src=""
                  draws the browser's torn-page glyph — which reads as "this
                  person sent you something and it's gone." Waiting quietly
                  is the honest state. */}
              {/* 🎬 A VIDEO IN A DIRECT MESSAGE (0133).

                  🔴 A SIBLING OF THE PICTURES, NOT NESTED INSIDE THEM.
                  This first went in under `pics.length > 0`, which both
                  broke the JSX and — had it compiled — would have hidden
                  the video on every message that had no photos, which is
                  most of them. A video is its own medium, not a
                  decoration on a photo block.

                  ⚠️ preload="metadata" and no autoplay: a DM video is the
                  most private thing in the app and must not start playing
                  because somebody opened a thread. */}
              {m.video_url && urls[m.video_url] && (
                <video className="dmvid" src={urls[m.video_url]}
                       controls playsInline preload="metadata" />
              )}
              {pics.length > 0 && (
                <div className="dmpics">
                  {pics.map((p, i) => (urls[p] ? (
                    <Shot key={p} path={p} src={urls[p]} alt="" className="dmpic"
                          zoom={{ items: pics.map((x) => ({ path: x, url: urls[x] })), i }}
                          onFixed={(k, u) => setUrls((m) => ({ ...m, [k]: u }))} />
                  ) : null))}
                </div>
              )}
              <Body text={m.body} tags={people} />
            </div>
          );
        })}
        {waiting && msgs.length > 0 && (
          /* Says "sent", never "unread" or "not seen". From here an
             ignored request and an unopened app are the same thing, and
             this line has to be true of both. */
          <p className="cnote">Sent. You&apos;ll be able to write again once they reply.</p>
        )}
        <div ref={foot} />
      </div>

      {err && <div className="pad"><div className="err">{err}</div></div>}

      {/* Clears the fixed bar AND the tab bar under it. ⚠️ The 76px in
          wall.css is now only the STARTING height — the effect above
          measures the real dock and rewrites it, so a grown composer, a
          staged photo tray or an error line can no longer park the
          newest message behind the box you answer in. */}
      <div className="convopad" ref={padRef} aria-hidden="true" />

      {/* Staged photos, above the bar, with a way to take one back out.
          ⚠️ Removing from the tray does NOT delete the uploaded file — it
          is already stripped and sitting in dm-photos with nothing
          pointing at it, which is exactly what the orphan sweeper is for.
          Deleting here would mean a delete call that can fail while the
          user is mid-message, for a file nobody can reach. */}
      {/* 🔴 THE DOCK. Everything that belongs to the composer lives inside
          ONE fixed container, and .cbar is static inside it (app/convo.css).

          Before this, .cbar was position:fixed on its own and the tag
          menu, the emoji panel and the staged tray were rendered as its
          siblings IN NORMAL FLOW — so they did not stack above the bar,
          they sat in the page behind it. That is the real reason "chat
          tagging doesn't work": the menu was mounting correctly and
          landing underneath a fixed element.

          ⚠️ Do NOT go back to giving each one its own `bottom:` value.
          The bar's height moves with the font size, the safe-area inset
          and whether the error line is showing, and every one of those
          silently slides a panel over the bar or opens a gap. A
          container cannot drift out of sync with its own contents. */}
      <div className="dmdock" ref={dockRef}>

      <EmojiPicker open={emoji} onClose={() => setEmoji(false)} onPick={insertEmoji} />

      {/* 🔴 `|| vid` — WITHOUT IT, STAGING ONLY A VIDEO RENDERED NO TRAY.
          The gate was tray.length alone, and tray holds photos only, so a
          video with no photo alongside it was invisible and the button to
          take it back off was unreachable. Same shape as the bug where
          this whole block was nested inside the photos branch: the video
          path keeps getting written as if a photo is always there too. */}
      {(tray.length > 0 || vid) && (
        <div className="dmtray">
          {vid && (
            <div className="dmtray-one">
              <video src={vid.preview} controls playsInline preload="metadata" />
              <button type="button" className="dmtray-x" aria-label="Take the video off"
                      onClick={() => setVid(null)}>×</button>
            </div>
          )}
          {tray.map((t, i) => (
            <button key={t.path} type="button" className="dmtrayx"
                    aria-label="Remove this picture"
                    onClick={() => setTray((v) => v.filter((_, j) => j !== i))}>
              <img src={t.preview} alt="" />
              <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      {/* .cbar, NOT .composer — the green room re-declares .composer as
          position:static so it can sit at the top of the wall, and
          inheriting that here would unpin the message box. */}
      {/* ⚠️ Above the bar — this composer is pinned to the bottom, so a
          menu under it opens behind the keyboard. Same reasoning as the
          rooms and the reply sheet. It is INSIDE the dock, which is what
          makes "above the bar" actually true rather than merely intended. */}
      {tag.menu}

      <form className="cbar" onSubmit={send}>
        {/* ⚠️ type="button". Inside a <form>, a button with no type IS a
            submit button — so opening the picker would send the message
            instead. The room composer carries the same note for the same
            reason; this is the second place that trap exists. */}
        <button type="button" className="dmemo"
                aria-expanded={emoji} aria-label="Open emoji"
                onClick={() => setEmoji((v) => !v)} disabled={waiting}>
          🙂
        </button>
        <PhotoUpload
          kind="dm"
          label="🖼️"
          busyLabel="…"
          className="dmpick"
          onBusy={setUpBusy}
          /* 🎬 Video in a DM (0133). ⚠️ Narrowed once one is staged: one
             video per message, so a second is a file we would refuse. */
          accept={vid ? 'image/*' : 'image/*,video/mp4,video/quicktime'}
          onDone={(path, preview, isVideo) => {
            if (isVideo) setVid({ path, preview });
            else setTray((t) => [...t, { path, preview }]);
          }}
        />
        {/* 📝 12 Sept — GROWING BOX, the fourth and last composer. Was an
            <input> carrying 5,000 characters — the biggest cap in the app
            in a box that showed one line. Text in an input does not wrap;
            it scrolls sideways out of view.
            ⚠️ NO `.cbox` HERE EITHER — this bar is white on green and the
            Wall's box is cream on acid. Behaviour shared, skin never.
            ⚠️ `.cbar input` in theme-green.css is a TAG selector, so it
            stops matching the moment this becomes a textarea. That rule
            is widened in the same commit — a tag-based selector is a
            silent dependency and changing the tag breaks it with no error.
            ⚠️ onInput, so the @menu's own onChange in tag.inputProps is
            untouched. Border added back for box-sizing: border-box. */}
        <textarea ref={inputRef} value={body} {...tag.inputProps} rows={1}
               onInput={(e) => {
                 e.target.style.height = 'auto';
                 const bs = getComputedStyle(e.target);
                 const edge = parseFloat(bs.borderTopWidth) + parseFloat(bs.borderBottomWidth);
                 e.target.style.height = (e.target.scrollHeight + edge) + 'px';
                 /* ⚠️ The box just changed size, so the space reserved for
                    it is now wrong. Correcting it here — in the same event
                    — is what keeps the newest message visible WHILE you
                    type, not only after you send. */
                 fitPad();
               }}
               maxLength={5000} placeholder={waiting ? 'Waiting on a reply…' : 'Write a message… @ to tag'}
               aria-label="Message" disabled={waiting} />
        {/* ⚠️ A picture alone is enough to enable Send (0128) — but never
            while an upload is still running, or the path isn't in the tray
            yet and the photo is silently dropped from the message. */}
        <button type="submit"
                disabled={busy || waiting || upBusy || (!body.trim() && tray.length === 0 && !vid)}>
          Send
        </button>
      </form>

      </div>{/* .dmdock */}
    </>
  );
}
