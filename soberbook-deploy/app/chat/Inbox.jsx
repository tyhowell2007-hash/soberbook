'use client';

import { useState } from 'react';
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
  const [showQuiet, setShowQuiet] = useState(false);

  /* 🔴 THE CHAT DOT NO LONGER CLEARS HERE — 3 Sept, and this is a
     deletion, not a change.

     What used to sit here was `notifications_mark_read('message')` in an
     effect on mount. It was careful about the KIND — only messages, so a
     reply notification survived — and completely wrong about the SCOPE.
     It marked every message notification read across EVERY thread the
     moment you looked at the list of names. `notifications_clear_seen()`
     then deletes anything read, so they were gone for good.

     ⭐ Ty had 133 threads, 35 messages sent to him, and had never seen a
     single notification. **The more people talk to you, the more
     completely it failed** — one glance at Chat wiped the lot. He
     reported it as "I'm not getting notifications anywhere."

     ⚠️ THIS IS THE 30 AUGUST WALL BUG IN A SECOND PLACE. That one ran
     `notifications_mark_read('reply')` on mount because "the reply is on
     this page somewhere". Same reasoning, same damage, and the rule
     written down then is the rule now: **a surface may mark read exactly
     what it displayed the CONTENTS of.** This screen displays a list of
     names. It has never displayed one word of anybody's message.

     ⚠️ The dot is not left stuck: `app/chat/[id]/Convo.jsx` clears that
     ONE thread via notifications_mark_thread_read() (0120) when you
     actually open the conversation and read it. That function did not
     exist until today, which is why the inbox reached for the blanket
     one — it was the only tool in the drawer, not laziness. */

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

  /* ⭐ THREE GROUPS, AND THE MEASUREMENT IS THE WHOLE ARGUMENT — 3 Sept.

     Ty: "I have to sift through everything to find where I'm at. We need
     to make this easier so I don't have to do that like Facebook does."

     His inbox: 133 threads, he spoke last in 132, 117 are a hello nobody
     answered, and EXACTLY ONE is waiting on him. A flat list ordered by
     recency puts that one somewhere in the middle of 132 rows that need
     nothing from anyone.

     🔴 An unread badge would not have helped, and that is why this looks
     the way it does rather than like every other inbox. He has zero
     unread — honestly zero — so the Facebook-shaped fix would have given
     him 133 rows and no badges at all. The useful question here is not
     "is there something new" but **"is anybody waiting on me?"**

     ⚠️ `they_spoke_last` and `they_ever_spoke` come from chat_threads
     (0122) and are NOT derived here. Members have no SELECT on
     `messages` at all — the view is the only thing permitted to look, so
     re-deriving this in the browser is not a style preference, it is
     impossible without undoing the chat privacy model.

     ⚠️ The three tests are mutually exclusive and cover every row,
     proven in SQL before this was written: 1 + 15 + 117 = 133, and a
     thread with no messages at all (both columns NULL) lands in `rest`
     rather than under a heading that would describe it wrongly. */
  const waiting = inbox.filter((t) => t.they_spoke_last === true);
  const quiet   = inbox.filter((t) => t.they_spoke_last !== true && t.they_ever_spoke === false);
  const rest    = inbox.filter((t) => t.they_spoke_last !== true && t.they_ever_spoke !== false);

  /* ⚠️ NOT a component defined inside render — that remounts the whole
     row on every keystroke elsewhere in this file. Plain function, called. */
  function thread(t, waitingOnYou) {
    return (
      <Link key={t.id} href={`/chat/${t.id}`} className="clink">
        <Row t={t}>
          {Number(t.unread) > 0
            ? <span className="cdot" aria-label={`${t.unread} unread`}>{t.unread}</span>
            : waitingOnYou
              ? <span className="ib-dot" aria-label="Waiting on you" />
              : null}
        </Row>
      </Link>
    );
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

      {/* 🔴 The old row rendered `t.state === 'sent' ? "Sent"` here. That
          has been DEAD CODE since 29 Aug: 0087 made chat_send_blocked()
          return false for everyone, so the view reports 'open' for every
          thread and 'sent' can never appear. Measured on the live data —
          all 133 of Ty's threads come back 'open'. Removed rather than
          left to look like a working label. */}

      {waiting.length > 0 && (
        <div className="ib-grp">
          <span className="ib-head">
            Waiting on you <span className="ib-n">· {waiting.length}</span>
          </span>
          <div className="ib-wait">
            {waiting.map((t) => thread(t, true))}
          </div>
        </div>
      )}

      {/* No heading on the middle group. It is the normal case, and a
          label over "ordinary conversations" is furniture. */}
      {rest.length > 0 && (
        <div className="ib-grp">
          {rest.map((t) => thread(t, false))}
        </div>
      )}

      {quiet.length > 0 && (
        <div className="ib-grp">
          {/* ⚠️ Collapsed by default, and the wording is deliberately not
              "no reply" or "ignored". These are people he wrote to who
              haven't answered YET — a lot of them joined days ago and
              have never used the app at all. The group exists to get
              them out of the way, not to keep score. */}
          <button type="button" className="ib-toggle"
                  aria-expanded={showQuiet}
                  onClick={() => setShowQuiet((v) => !v)}>
            You said hi, nothing back yet · {quiet.length}
            <span className="ib-caret" aria-hidden="true">{showQuiet ? '⌃' : '⌄'}</span>
          </button>
          {showQuiet && (
            <div className="ib-quiet">
              {quiet.map((t) => thread(t, false))}
            </div>
          )}
        </div>
      )}

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
