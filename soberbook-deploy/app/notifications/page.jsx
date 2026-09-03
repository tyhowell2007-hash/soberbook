import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Rows from './Rows';
import TagReview from './TagReview';

export const dynamic = 'force-dynamic';

/* =====================================================================
   WHAT YOU MISSED.  Aug 30, extended 31 Aug.

   ⭐ THE ELEVENTH "EVERYTHING BUILT EXCEPT THE WAY IN", AND THE ONE THAT
   EXPLAINS THE QUIET.

   `notifications`, the three triggers that write to it, `my_notifications`
   with its anonymity handling, the push pipeline and the service worker
   have all existed since 18 Aug. What never existed was a page. So the
   entire record of "somebody answered you" was a single dot on a tab —
   visible only if you were already in the app, and gone the moment you
   tapped.

   ---------------------------------------------------------------------
   ⚠️ EVERYTHING HERE COMES FROM `my_notifications` AND NOTHING ELSE.

   `authenticated` has no grant on the `notifications` table itself, and
   that was deliberate (0080): the table carries `actor_id` on anonymous
   mentions, so a direct read hands back exactly the identity the app
   exists to protect. The view already does the work — 'Someone' when the
   actor was anonymous, NULL handle, the post excerpt for replies, and a
   filter for suspended accounts. There is nothing to re-derive here, and
   re-deriving it is how the two copies drift apart.

   ⚠️ THE SAME RULE IS WHY DISMISSING GOES THROUGH A FUNCTION. Members
   have no DELETE on `notifications` either, and handing one out would
   mean handing out a WHERE clause — and a WHERE clause is a read.
   notification_dismiss() and notifications_clear_seen() (0099) scope
   themselves to current_uid(), so there is no id a caller can pass that
   touches somebody else's row.

   ---------------------------------------------------------------------
   ⭐ THE LIST ITSELF NOW LIVES IN Rows.jsx, A CLIENT COMPONENT.

   This page keeps the read, because the read is where the anonymity
   handling is and that belongs on the server. Rows only holds a local
   copy so a dismissed notification can leave the screen immediately.
   ===================================================================== */

export default async function NotificationsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from(assertReadable('my_notifications'))
    .select('id, kind, created_at, unread, post_id, thread_id, who, who_handle, about')
    .order('created_at', { ascending: false })
    .limit(100);

  /* 🔴 ASKED SERVER-SIDE, AND ONLY THE DATABASE DECIDES.

     push_ask_due() is SECURITY DEFINER: it reads `profiles`, `posts`,
     `notifications` and `push_subscriptions`, none of which this member
     may read directly, and hands back a single boolean. Nothing about
     who qualifies is expressed in this file — 0099 widened the rule to
     include "somebody has answered you" and 0100 added "and you haven't
     already said yes", and neither change needed a line here. That is
     the point of it being a function.

     ⚠️ Server-side rather than in an effect, so the card is either in
     the first paint or absent. The wall asks the same question from the
     browser; there it's fine, because the card appears in response to an
     action the person just took. Here it would be a box appearing under
     their thumb a second after the page settled. */
  let askPush = false;
  try {
    const { data: due } = await supabase.rpc('push_ask_due');
    askPush = due === true;
  } catch { /* no card is the safe failure — never a broken one */ }

  /* ⭐ TAGS AWAITING YOUR YES. Fetched here rather than folded into
     my_notifications, and that is deliberate: a pending tag is not a
     notification, it is a QUESTION. It has no read_at, nothing may
     clear it, and it should stay on the screen until answered.
     Putting it in the notifications table would mean four separate rules
     saying "except this kind". */
  let pendingTags = [];
  try {
    const { data } = await supabase.rpc('my_pending_tags');
    pendingTags = data || [];
  } catch { /* the rest of the page is still worth showing */ }

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back">‹</Link>
        <span className="lg cvname">What you missed</span>
      </div>

      {/* 🔴 MARKING READ IS PER-ITEM NOW, AND MarkSeen IS DELETED —
          3 Sept.

          It used to be a client effect on this page that marked every
          reply and every mention read the moment the page mounted. It
          obeyed the 30 Aug rule about KIND — it never touched messages,
          because this page shows that a message exists and never its
          words — and it broke a rule nobody had written down yet:
          **displaying five things is not evidence that somebody read
          five things.**

          Ty: "if somebody has five notifications and they click one, and
          that clears all of them, that's not good… That way people can
          keep tabs on everything."

          ⭐ So a row is now marked read when it is TAPPED, one at a time,
          by notification_mark_read() in 0121. Rows.jsx owns it, because
          Rows.jsx owns the tap.

          ⚠️ Ty's call, made after hearing both sides: the dot STAYS LIT
          until every unread one has been opened. my_nav_dots reads
          unread rows, so that behaviour falls out of this with no extra
          code — a lingering dot is the feature, not a bug to fix later
          with a blanket mark-read. */}

      <div className="pad ntfwrap">
        {/* ⚠️ ABOVE the list. A question you have to answer outranks a
            record of things that already happened — and unlike the rows
            below, this one doesn't go away by being looked at. */}
        <TagReview initial={pendingTags} />
        <Rows initial={rows || []} askPush={askPush} />
      </div>
    </>
  );
}
