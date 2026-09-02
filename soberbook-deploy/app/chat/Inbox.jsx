'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import Directory from './Directory';

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

export default function Inbox({ inbox, requests, members = [] }) {
  /* Two tabs, not two pages. Your conversations and everybody else are the
     same question — "who can I talk to" — and splitting them across routes
     would mean a person with no conversations lands on an empty screen and
     has to go looking for the door. */
  const [tab, setTab] = useState('chats');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(requests);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const router = useRouter();

  /* ---- the Chat dot clears here ----

     ⚠️ ONLY 'message'. Not a blanket mark-read — opening the inbox must
     not put out the Home dot for a reply you haven't looked at yet.

     ⚠️ And note this clears on the INBOX, not on accepting a request. A
     request never created a notification in the first place (0025's
     trigger refuses un-accepted threads), so there is nothing here that
     could betray the gate. */
  useEffect(() => {
    browserClient().rpc('notifications_mark_read', { p_kind: 'message' })
      .then(() => router.refresh())
      .catch(() => {});
    /* eslint-disable-next-line */
  }, []);

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
      <div className="ctabs" role="tablist">
        <button role="tab" aria-selected={tab === 'chats'}
                className={'ctab' + (tab === 'chats' ? ' on' : '')}
                onClick={() => setTab('chats')}>Conversations</button>
        <button role="tab" aria-selected={tab === 'all'}
                className={'ctab' + (tab === 'all' ? ' on' : '')}
                onClick={() => setTab('all')}>
          Everybody{members.length ? ` · ${members.length}` : ''}
        </button>
      </div>

      {tab === 'all' && <Directory members={members} />}

      {tab === 'chats' && <>
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
          {/* 🔴 THIS USED TO SAY "Their first message to you lands as a
              request — yours to accept or not." THAT BECAME FALSE ON 29 AUG
              and nobody noticed for four days.

              `0087` removed the stranger cap at Ty's direction, and
              chat_send_blocked() is now literally `select false`. Anyone
              here can message anyone, immediately, as often as they like.

              ⚠️ It is not a stale label, it is a SAFETY CLAIM — and this is
              the empty state, so it is the first thing a brand-new member
              reads about messages. Somebody told they have a gate will
              reasonably assume strangers cannot reach them. They can.

              Same category as "Verified, real people" (15 Aug) and "No Zoom
              account needed — join as a guest" (20 Aug): a promise the app
              had stopped being able to keep.

              ⭐ The replacement says what protection actually EXISTS rather
              than going silent — block and report are real, reachable from
              a row, a profile and a conversation, and a block outranks
              everything including the owner account. */}
          <p className="p">
            Tap <b>Everybody</b> above to see who&apos;s here. Anyone in here can
            message you — and you can block or report anyone, any time, from
            the <b>⋯</b> on their name.
          </p>
        </div>
      )}
      </>}
    </div>
  );
}
