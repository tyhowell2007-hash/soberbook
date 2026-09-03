'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';
import RowMenu from '../../friends/RowMenu';

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
    if (!text || busy) return;
    setBusy(true); setErr('');

    const supabase = browserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('messages')
      .insert({ thread_id: thread.id, sender_id: user.id, body: text });
    setBusy(false);

    /* The database refuses a second message to somebody who hasn't
       replied, and the refusal comes back as plain English written in the
       trigger. Show it as-is: it says nothing the sender doesn't already
       know, and rewording it here would risk saying more. */
    if (error) { setErr(error.message.replace(/^.*?:\s*/, '')); return; }

    setBody('');
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
        {msgs.map((m) => (
          <div key={m.id} className={'bub' + (m.is_mine ? ' mine' : '')}>
            {m.body}
          </div>
        ))}
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

      {/* .cbar, NOT .composer — the green room re-declares .composer as
          position:static so it can sit at the top of the wall, and
          inheriting that here would unpin the message box. */}
      <form className="cbar" onSubmit={send}>
        <input value={body} onChange={(e) => setBody(e.target.value)}
               maxLength={5000} placeholder={waiting ? 'Waiting on a reply…' : 'Write a message…'}
               aria-label="Message" disabled={waiting} />
        <button type="submit" disabled={busy || waiting || !body.trim()}>Send</button>
      </form>
    </>
  );
}
