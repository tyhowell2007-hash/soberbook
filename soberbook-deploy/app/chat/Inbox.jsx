'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE INBOX, AND THE REQUESTS LANE ABOVE IT.

   The design argument worth writing down, because it looks like a
   mistake: a request shows you the message before you accept it.

   The safer-sounding version hides the text and offers "Accept / Ignore"
   on a name alone. It is worse. Deciding blind is a coin flip, and people
   who have to coin-flip start accepting everything — at which point the
   gate you built is decoration and the harasser is in the inbox anyway.
   Showing one line is what makes "ignore" a real choice.

   It is safe to show precisely because of the one-message rule in the
   database: they get exactly one line until you answer. A person can
   absorb one unpleasant sentence. Thirty is a different injury, and the
   trigger in 0016_chat.sql is what makes thirty impossible.
   ===================================================================== */

function Row({ t, children }) {
  return (
    <div className="crow">
      <div className="cav" aria-hidden="true">{t.other_avatar || '🙂'}</div>
      <div className="cwho">
        <span className="cname">{t.other_name}</span>
        <span className="clast">{t.last_body || 'No messages yet'}</span>
      </div>
      {children}
    </div>
  );
}

export default function Inbox({ inbox, requests }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(requests);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  async function answer(id, yes) {
    setBusy(id); setErr('');
    const supabase = browserClient();
    const { error } = await supabase.rpc(yes ? 'accept_thread' : 'decline_thread', { t_id: id });
    setBusy(null);

    /* ⚠️ NOT OPTIMISTIC, ON PURPOSE — the same call made about blocking on
       Aug 6. If the row only disappears in the browser and the write
       failed, the app has told somebody they are safe when they are not.
       So it waits for the database, and on failure it stays put and says
       so. A slower yes is fine; a fake yes is not. */
    if (error) { setErr(error.message); return; }
    setPending((list) => list.filter((t) => t.id !== id));
    if (yes) window.location.href = `/chat/${id}`;
  }

  const nothing = inbox.length === 0 && pending.length === 0;

  return (
    <div className="pad">
      {err && <div className="err">{err}</div>}

      {pending.length > 0 && (
        <>
          <button className="creq" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <span className="cnum">{pending.length}</span>
            <span className="creqt">
              {pending.length === 1 ? 'message request' : 'message requests'}
              <span className="creqs">From people you haven&apos;t talked to</span>
            </span>
            <span className="ccaret" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
          </button>

          {open && (
            <div className="creqlist">
              {pending.map((t) => (
                <Row key={t.id} t={t}>
                  <div className="cbtns">
                    <button className="cyes" disabled={busy === t.id}
                            onClick={() => answer(t.id, true)}>Accept</button>
                    {/* Same size, same weight as Accept. Making "Ignore"
                        the small grey one would be the app leaning on
                        somebody to say yes to a stranger. */}
                    <button className="cno" disabled={busy === t.id}
                            onClick={() => answer(t.id, false)}>Ignore</button>
                  </div>
                </Row>
              ))}
              <p className="cgate">
                They can&apos;t send another until you reply. If you ignore this,
                it disappears and they&apos;re not told.
              </p>
            </div>
          )}
        </>
      )}

      {inbox.map((t) => (
        <Link key={t.id} href={`/chat/${t.id}`} className="clink">
          <Row t={t}>
            {Number(t.unread) > 0
              ? <span className="cdot" aria-label={`${t.unread} unread`}>{t.unread}</span>
              : t.state === 'sent' ? <span className="csent">Sent</span> : null}
          </Row>
        </Link>
      ))}

      {nothing && (
        <div className="empty">
          <div className="h">No conversations yet</div>
          <p className="p">
            Open somebody&apos;s page from the wall and tap Message. Their first
            message to you lands here as a request — yours to accept or not.
          </p>
        </div>
      )}
    </div>
  );
}
