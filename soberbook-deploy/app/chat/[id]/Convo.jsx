'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { browserClient } from '../../../lib/supabase-browser';

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

  const waiting = thread.state === 'sent';   // they haven't answered yet

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
      <div className="mast">
        <Link href="/chat" className="back" aria-label="Back to chat">‹</Link>
        <span className="lg">{thread.other_name}</span>
        <Link href={`/u/${thread.other_handle}`} className="rt melink">their page ›</Link>
      </div>

      <div className="convo">
        {msgs.length === 0 && (
          <p className="cnote">Say hello. They&apos;ll see it as a request first.</p>
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
