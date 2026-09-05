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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(requests);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

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

  /* =====================================================================
     ⭐ ONE LIST, NOT TWO TABS — 4 Sept. Ty: "we only need one that has the
     total amount of people up above."

     What was here: a Conversations tab and an Everybody tab. The split
     made sense when the app had eighteen members and your conversations
     were most of what you'd want. It stopped making sense overnight.

     🔴 THE MEASUREMENT THAT SETTLED IT: after the hello went out, every
     one of the 201 members has at least one thread — and 123 of them have
     EXACTLY ONE, which is Ty's. So for most people Chat opened on a list
     of one name, with the other two hundred hidden behind a word they had
     to know to tap. That is the same "everything built except the way in"
     shape as delete-your-post, "Say hi", sign out and the content hide
     button, and it is the twelfth or thirteenth instance this month.

     ⚠️ AND THIS IS THE THING THE 3 SEPT REVERT WARNED ABOUT, DONE ON
     PURPOSE THIS TIME. That night a grouping shipped unasked, Ty's 133
     rows became 16 behind a toggle, and he reported chat as broken. The
     lesson written then — people navigate a familiar list by shape and
     position, so reorganising somebody's inbox is never neutral — still
     stands. What is different: he asked for this one, saw a working
     prototype with his own data first, and said ship it. The cost is the
     same; the difference is that he chose to pay it.
     ===================================================================== */

  /* 🔴 "TALKING" MEANS THEY HAVE SPOKEN, NOT THAT A THREAD EXISTS, and
     that distinction is the whole reason this list is readable.

     `inbox` is ordered by last_message_at, so the obvious version — show
     every thread with its preview — puts 181 identical copies of Ty's own
     hello at the top of his screen. Measured on the live data the night it
     went out: 199 threads, 18 where the other person has ever said a word.

     ⚠️ So a thread earns the preview-and-unread treatment only once
     they_ever_spoke (0122). Everybody else is a person you can message,
     which is exactly what the directory row already is — no second row
     type, no second implementation.

     ⚠️ they_ever_spoke, NOT they_spoke_last. Somebody who answered you in
     August and has been quiet since is still a conversation; using
     "who spoke last" would drop them out of the list the moment you had
     the final word, which is the opposite of what a chat list is for. */
  const talking = inbox.filter((t) => t.they_ever_spoke);
  const spoken = new Set(talking.map((t) => t.other_handle));

  const term = q.trim().toLowerCase();
  const hit = (a, b) =>
    !term ||
    (a || '').toLowerCase().includes(term) ||
    (b || '').toLowerCase().includes(term);

  const shownTalking = talking.filter((t) => hit(t.other_name, t.other_handle));

  /* ⚠️ Anyone already shown above is removed here, or they appear twice —
     once with their last message and once as a plain name. The key is the
     HANDLE, not the thread id, because the two lists come from two
     different views and only the handle is common to both. */
  const rest = members.filter(
    (m) => !spoken.has(m.handle) && hit(m.display_name, m.handle)
  );

  const noResults = term && shownTalking.length === 0 && rest.length === 0;

  return (
    <div className="pad">
      {/* ⚠️ The count is the plain number of people, not "Everybody · 201".
          The word was carrying tab-label weight it no longer needs to:
          you are looking at everybody, so saying so twice is noise. */}
      <div className="ib-top">
        <span className="ib-title">Everybody</span>
        {members.length > 0 && (
          <span className="ib-count">{members.length} people</span>
        )}
      </div>

      {/* 🔴 THE SEARCH BOX IS NEW AND IS HALF THE POINT OF MERGING.
          Neither tab had one. A list of 201 names is only usable if you
          can jump to one, and without it "one list" would just be a
          longer scroll than the thing it replaced. */}
      <input
        className="ib-find"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people…"
        aria-label="Search people"
      />

      {err && <div className="err">{err}</div>}

      {/* ⚠️ REQUESTS STAY THEIR OWN STRIP, ABOVE EVERYTHING, AND ARE NOT
          FOLDED INTO THE LIST. This is a safety surface, not a sorting
          preference — a request buried at position 40 of 201 is a request
          nobody answers. It is also deliberately NOT filtered by the
          search box: hiding a pending request because somebody typed a
          name would be the app quietly withholding a decision that is
          theirs to make. */}
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

      {/* ⚠️ `t.state === 'sent' ? "Sent"` used to sit here and has been
          DEAD CODE since 29 Aug — 0087 made chat_send_blocked() return
          false for everyone, so every thread reports 'open' and that
          label can never render. Measured on the live data: all 133 of
          Ty's threads come back 'open'. It stays removed. */}
      {shownTalking.length > 0 && (
        <div className="ib-grp">
          {shownTalking.map((t) => (
            <Link key={t.id} href={`/chat/${t.id}`} className="clink">
              <Row t={t}>
                {Number(t.unread) > 0
                  ? <span className="cdot" aria-label={`${t.unread} unread`}>{t.unread}</span>
                  : null}
              </Row>
            </Link>
          ))}
        </div>
      )}

      {/* A hairline, not a heading. "Talking" and "Everyone else" as two
          labelled sections is the grouping that got reverted on 3 Sept —
          it turns one list back into two and invites the same "where did
          my list go" reaction. A rule is enough to say the order changed
          without claiming the two halves are different kinds of thing. */}
      {shownTalking.length > 0 && rest.length > 0 && (
        <div className="ib-rule" aria-hidden="true" />
      )}

      {rest.length > 0 && <Directory members={rest} />}

      {noResults && (
        <p className="ib-note">Nobody here by that name.</p>
      )}

      {/* 🔴 THIS USED TO SAY "Their first message to you lands as a
          request — yours to accept or not." THAT BECAME FALSE ON 29 AUG
          and nobody noticed for four days.

          `0087` removed the stranger cap at Ty's direction, and
          chat_send_blocked() is now literally `select false`. Anyone
          here can message anyone, immediately, as often as they like.

          ⚠️ It is not a stale label, it is a SAFETY CLAIM. Somebody told
          they have a gate will reasonably assume strangers cannot reach
          them. They can.

          ⚠️ It no longer says "tap Everybody above" — there is no
          Everybody tab to tap. The whole app is on this screen now, so
          the sentence that survives is the one about protection, which is
          the half that was load-bearing. */}
      {members.length === 0 && pending.length === 0 && (
        <div className="empty">
          <div className="h">Nobody here yet</div>
          <p className="p">
            Anyone in here can message you — and you can block or report
            anyone, any time, from the <b>⋯</b> on their name.
          </p>
        </div>
      )}
    </div>
  );
}
