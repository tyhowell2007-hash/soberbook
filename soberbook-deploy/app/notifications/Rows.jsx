'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import PushAsk from '../components/PushAsk';

/* =====================================================================
   THE BELL'S LIST, AND THE BROOM.  31 Aug.

   Ty: "if they get too cluttered up, we need a way for them to disappear
   as well, like a delete button."

   ---------------------------------------------------------------------
   ⚠️ WHY THIS IS A CLIENT COMPONENT AT ALL.

   The page is a server component and stays one — it does the read, which
   is where the anonymity handling lives. This owns nothing but the local
   copy of the list, so a dismissed row can leave the screen the instant
   it's tapped instead of after a round trip and a re-render.

   ⚠️ DISMISSING IS OPTIMISTIC. BLOCKING IS NOT, AND THAT DIFFERENCE IS
   DELIBERATE. A dismiss that silently failed puts a notification back on
   the next refresh — mildly annoying, self-correcting, and visible. The
   19 Aug rule about blocks (never optimistic, wait for the database)
   exists because a block that only LOOKS like it worked leaves somebody
   believing they're safe. Clearing a doormat is not that.

   ⭐ AND NOTHING HERE DELETES WHAT THE NOTIFICATION WAS ABOUT. The reply
   is still on the post, the message is still in the thread. This clears
   the record that it arrived, not the thing that arrived.
   ===================================================================== */

/* ⚠️ WHOLE DAYS, NEVER CLOCK TIMES. Same rule as the friends list: "2:14
   AM" published on a page somebody else can see over your shoulder tells
   a story about your night that a day count doesn't. Also honest — we
   don't know their timezone. */
function whenWord(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

export default function Rows({ initial, askPush: askPushInitial }) {
  const router = useRouter();
  const [list, setList] = useState(initial || []);
  const [askPush, setAskPush] = useState(!!askPushInitial);
  const [busy, setBusy] = useState(false);

  async function dismiss(id) {
    /* Off the screen first. If the call fails the row comes back on the
       next load, which is the correct failure: nothing was lost. */
    setList((rows) => rows.filter((r) => r.id !== id));
    try {
      await browserClient().rpc('notification_dismiss', { p_id: id });
    } catch { /* it'll be here next time */ }
  }

  /* 🔴 THIS ONE IS NOT OPTIMISTIC, AND THE REASON IS A BUG I NEARLY
     SHIPPED. My first version filtered the local list by `!unread` to
     match what the function deletes. That is wrong here, and subtly:
     MarkSeen has already run on this very page and marked every reply
     and mention read IN THE DATABASE, while the copy in this component
     still says unread — it was fetched a moment earlier. So the filter
     would have kept rows the database had just deleted, and the screen
     would have quietly disagreed with reality until a reload.

     ⭐ The fix is to stop predicting. router.refresh() re-runs the server
     read, so what appears afterwards is what actually survived. Same
     lesson as 0046 → 0049: don't restate a rule in a second place, ask
     the one thing that owns it. */
  async function clearSeen() {
    setBusy(true);
    try {
      await browserClient().rpc('notifications_clear_seen');
      router.refresh();
    } catch { /* leave the list alone; a reload will tell the truth */ }
    setBusy(false);
  }

  /* ⚠️ A DISPLAY HINT, NOT THE RULE. The rule is `read_at is not null`,
     and it lives in notifications_clear_seen() where it can be enforced.
     This only decides whether to draw the button, and it has to account
     for MarkSeen having already read the replies out from under us — so
     the only thing it treats as un-clearable is an unread MESSAGE, which
     is the one kind this page is not entitled to clear.

     If that's everything, the button has no work to do and shouldn't be
     on the screen; a control that does nothing when tapped is worse than
     an absent one. */
  const clearable = list.filter((r) => !(r.unread && r.kind === 'message')).length;

  return (
    <>
      {/* ⭐ THE ASK MOVED HERE FROM THE WALL, 31 Aug, and the reason is a
          number: 125 members, 3 who could receive a notification, and 124
          who had never been asked. The old gate fired only after a first
          post, and 107 of 125 have never posted — so the question was
          locked behind the exact thing that isn't happening.

          🔴 It did NOT move to "on arrival", which was the obvious fix
          and the wrong one. On day one the honest answer to "notify me
          about what?" is nothing. Here there is a real reply from a real
          person sitting underneath the card. That's the whole difference,
          and it's why push_ask_due() asks about replies rather than just
          letting everybody through.

          ⚠️ Still a SOFT ask — "Not now" never touches the browser
          permission. See PushAsk. */}
      {askPush && (
        <PushAsk
          intro="Somebody answered you."
          onDone={() => setAskPush(false)}
        />
      )}

      {list.length === 0 && (
        /* ⚠️ Says the room is quiet FOR YOU, not that the room is quiet.
           At 125 members the wall is busy; an empty bell means nobody has
           answered you yet, and those are very different sentences to
           read on your first day. */
        <p className="ntfempty">
          Nothing yet. When somebody answers you or sends you a message,
          it turns up here.
        </p>
      )}

      {list.map((n) => {
        /* ⭐ EVERY ROW IS A LINK — 31 Aug, the change Ty asked for:
           tapping a notification takes you to the thing, the way Facebook
           does it. /p/[id] was built for exactly this, because the 20 Aug
           rule says a link that loads the right page and does the wrong
           thing is worse than a broken one. The fix was to build the
           destination, not to soften the link. */
        const href =
          n.kind === 'message' && n.thread_id ? `/chat/${n.thread_id}` :
          (n.kind === 'reply' || n.kind === 'mention') && n.post_id ? `/p/${n.post_id}` :
          null;

        const icon = n.kind === 'message' ? '✉️' : n.kind === 'mention' ? '@' : '💬';

        const line = n.kind === 'message' ? `${n.who} sent you a message`
          : n.kind === 'mention' ? `${n.who} mentioned you`
          : `${n.who} answered your post`;

        const body = (
          <>
            <span className="ntfav" aria-hidden="true">{icon}</span>
            <span className="ntfmid">
              <span className="ntfline">{line}</span>
              {/* ⚠️ The excerpt is of YOUR OWN post — the thing being
                  answered — not of their reply. Showing their words here
                  would leak the content of an anonymous reply into a list
                  that names nobody. */}
              {n.about && <span className="ntfabout">“{n.about}”</span>}
              <span className="ntfwhen">{whenWord(n.created_at)}</span>
            </span>
          </>
        );

        return (
          /* ⚠️ THE ✕ SITS OUTSIDE THE LINK, not inside it. An <a> wrapping
             a <button> is invalid HTML and, worse, a tap near the edge of
             the ✕ would navigate instead of dismissing — on the one
             control whose whole job is to make something go away. */
          <div key={n.id} className={'ntfitem' + (n.unread ? ' fresh' : '')}>
            {href ? (
              <Link href={href} className="ntfrow">{body}</Link>
            ) : (
              <div className="ntfrow">{body}</div>
            )}
            {/* 🔴 ALWAYS VISIBLE, NOT HIDDEN BEHIND AN EDIT MODE.
                Facebook buries its per-item control under a ⋯. This file
                has eleven separate entries where something was built and
                the way in was buried — log out, delete-your-post, "Say
                hi", the bell itself. A quiet grey ✕ costs a little
                tidiness and cannot become the twelfth.
                ⚠️ 44px, because it sits beside a link. */}
            <button
              type="button"
              className="ntfx"
              aria-label="Remove this notification"
              onClick={() => dismiss(n.id)}
            >
              ✕
            </button>
          </div>
        );
      })}

      {clearable > 0 && (
        <div className="ntfclearwrap">
          <button
            type="button"
            className="ntfclear"
            disabled={busy}
            onClick={clearSeen}
          >
            {busy ? 'Clearing…' : 'Clear what I’ve seen'}
          </button>
        </div>
      )}

      {list.length > 0 && (
        <p className="ntffoot">
          Replies, messages and mentions. Nothing else — there are no
          likes here, and there never will be.
        </p>
      )}
    </>
  );
}
