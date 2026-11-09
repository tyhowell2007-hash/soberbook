'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient, assertReadable } from '../../lib/supabase-browser';

/* =====================================================================
   WAITING ON YOU — 9 Nov 2026 (Kenny + Ty, guided experience).

   Measured the day this was built, across 497 members:
     • 192 of 261 friend requests had never been answered (74%). Since
       the September People-page change they only surface in the bell.
     • 53 of 65 one-to-one chats a MEMBER started never got a reply (82%).
     • Members with at least one friend: 79% have talked. Without: 21%.
   So the people already reaching out are mostly not being met, and the
   reason is that nothing on Home says somebody is waiting. This card
   says it, at the top of Home, and is one tap from the answer.

   ⚠️ NEVER SHOWS A WORD OF ANYBODY'S MESSAGE — only the name. Home is
   the screen most likely to be glanced at over a shoulder (that's why
   Quick exit exists on RecoveryMap). The words stay inside the chat.
   ⚠️ MARKS NOTHING READ. Same rule as Inbox.jsx: a surface may mark read
   exactly what it displayed the contents of, and this displays names.
   ⚠️ chat_threads, never threads — the view is what hides blocked people.
   ⚠️ Renders nothing at all when nobody is waiting, which is most days
   for most members. No zero, no empty state.
   ===================================================================== */
const MAX_REQ = 2;
const MAX_DM = 3;

function nameOf(handle, name) { return name || `@${handle}`; }

export default function WaitingOnYou() {
  const [reqs, setReqs] = useState([]);
  const [dms, setDms] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const supa = browserClient();
      try {
        const [{ data: r }, { data: t }] = await Promise.all([
          supa.rpc('my_friend_requests'),
          supa.from(assertReadable('chat_threads'))
            .select('id, other_handle, other_name, state, last_message_at, unread, they_spoke_last')
            .eq('they_spoke_last', true)
            .gt('unread', 0)
            .order('last_message_at', { ascending: false })
            .limit(MAX_DM),
        ]);
        if (!alive) return;
        setReqs((r || []).filter((x) => x.handle).slice(0, MAX_REQ));
        setDms((t || []).filter((x) => x.other_handle || x.other_name));
      } catch { /* nothing shown */ }
    })();
    return () => { alive = false; };
  }, []);

  async function answer(handle, yes) {
    setBusy(handle);
    try {
      await browserClient().rpc(yes ? 'accept_friend' : 'ignore_friend', { target_handle: handle });
      setReqs((r) => r.filter((x) => x.handle !== handle));
    } catch { /* leave it; the profile page can still answer it */ }
    setBusy('');
  }

  if (!reqs.length && !dms.length) return null;

  return (
    <section className="wy" aria-label="Waiting on you">
      {dms.map((t) => (
        <Link key={t.id} href={`/chat/${t.id}`} className="wy-row">
          <span className="wy-ic" aria-hidden="true">💬</span>
          <span className="wy-t"><b>{nameOf(t.other_handle, t.other_name)}</b> messaged you</span>
          <span className="wy-go">Reply</span>
        </Link>
      ))}
      {reqs.map((p) => (
        <div key={p.handle} className="wy-row">
          <span className="wy-ic" aria-hidden="true">👋</span>
          <Link href={`/u/${p.handle}`} className="wy-t"><b>{nameOf(p.handle, p.display_name)}</b> wants to be friends</Link>
          <span className="wy-acts">
            <button type="button" className="wy-go" disabled={busy === p.handle} onClick={() => answer(p.handle, true)}>Accept</button>
            <button type="button" className="wy-no" disabled={busy === p.handle} onClick={() => answer(p.handle, false)}>No thanks</button>
          </span>
        </div>
      ))}
    </section>
  );
}
