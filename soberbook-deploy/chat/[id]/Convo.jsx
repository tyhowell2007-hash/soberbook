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

  useEffect(() => { foot.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

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

    setBody(''); setTray([]); setVid(null);
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
                  {pics.map((p) => (urls[p] ? (
                    <Shot key={p} path={p} src={urls[p]} alt="" className="dmpic"
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

      {/* clears the fixed bar AND the tab bar under it */}
      <div className="convopad" aria-hidden="true" />

      {/* Staged photos, above the bar, with a way to take one back out.
          ⚠️ Removing from the tray does NOT delete the uploaded file — it
          is already stripped and sitting in dm-photos with nothing
          pointing at it, which is exactly what the orphan sweeper is for.
          Deleting here would mean a delete call that can fail while the
          user is mid-message, for a file nobody can reach. */}
      {tray.length > 0 && (
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

      <EmojiPicker open={emoji} onClose={() => setEmoji(false)} onPick={insertEmoji} />

      {/* .cbar, NOT .composer — the green room re-declares .composer as
          position:static so it can sit at the top of the wall, and
          inheriting that here would unpin the message box. */}
      {/* ⚠️ Above the bar — this composer is pinned to the bottom, so a
          menu under it opens behind the keyboard. Same reasoning as the
          rooms and the reply sheet. */}
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
        <input ref={inputRef} value={body} {...tag.inputProps}
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
    </>
  );
}
