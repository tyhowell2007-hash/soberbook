import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import MarkSeen from './MarkSeen';

export const dynamic = 'force-dynamic';

/* =====================================================================
   WHAT YOU MISSED.  Aug 30.

   ⭐ THE ELEVENTH "EVERYTHING BUILT EXCEPT THE WAY IN", AND THE ONE THAT
   EXPLAINS THE QUIET.

   `notifications`, the three triggers that write to it, `my_notifications`
   with its anonymity handling, the push pipeline and the service worker
   have all existed since 18 Aug. What never existed was a page. So the
   entire record of "somebody answered you" was a single dot on a tab —
   visible only if you were already in the app, and gone the moment you
   tapped.

   Measured tonight: 20 notifications fired in 24 hours to 14 people;
   eleven members had a reply to a post. Almost none of them know.

   ---------------------------------------------------------------------
   ⚠️ EVERYTHING HERE COMES FROM `my_notifications` AND NOTHING ELSE.

   `authenticated` has no grant on the `notifications` table itself, and
   that was deliberate (0080): the table carries `actor_id` on anonymous
   mentions, so a direct read hands back exactly the identity the app
   exists to protect. The view already does the work — 'Someone' when the
   actor was anonymous, NULL handle, the post excerpt for replies, and a
   filter for suspended accounts. There is nothing to re-derive here, and
   re-deriving it is how the two copies drift apart.
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

export default async function NotificationsPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from(assertReadable('my_notifications'))
    .select('id, kind, created_at, unread, post_id, thread_id, who, who_handle, about')
    .order('created_at', { ascending: false })
    .limit(100);

  const list = rows || [];

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back">‹</Link>
        <span className="lg cvname">What you missed</span>
      </div>

      {/* 🔴 MARKING READ IS A CLIENT EFFECT, AND IT ONLY CLEARS WHAT THIS
          PAGE ACTUALLY SHOWED. See MarkSeen for the full reasoning — the
          short version is that this page displays a reply's content but
          not a message's, so it may honestly clear the first and must not
          clear the second. */}
      <MarkSeen />

      <div className="pad ntfwrap">
        {list.length === 0 && (
          /* ⚠️ Says the room is quiet FOR YOU, not that the room is quiet.
             At 114 members the wall is busy; an empty bell means nobody
             has answered you yet, and those are very different sentences
             to read on your first day. */
          <p className="ntfempty">
            Nothing yet. When somebody answers you or sends you a message,
            it turns up here.
          </p>
        )}

        {list.map((n) => {
          /* ⭐ EVERY ROW IS A LINK NOW — 31 Aug, and this is the change
             Ty asked for: tapping a notification takes you to the thing,
             the way Facebook does it.

             This comment used to explain why a reply row COULDN'T be a
             link: there was no /p/<post> route, posts lived on the wall,
             and the wall carries no anchors, so linking to /wall would
             drop somebody at the top of a sixty-six-post feed with no
             idea which post was theirs. That was the 20 Aug rule — "a
             link that loads the right page but does the wrong thing is
             worse than a broken one."

             🔴 The rule never said don't link. It said don't fake it. So
             the fix was to build the destination, not to soften the link:
             /p/[id] renders the post with its whole conversation and the
             reply box already open.

             ⚠️ A message still goes to /chat/<thread>, not /p — its
             destination was always real. */
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
                    answered — not of their reply. Showing their words
                    here would leak the content of an anonymous reply
                    into a list that names nobody. */}
                {n.about && <span className="ntfabout">“{n.about}”</span>}
                <span className="ntfwhen">{whenWord(n.created_at)}</span>
              </span>
            </>
          );

          return href ? (
            <Link key={n.id} href={href} className={'ntfrow' + (n.unread ? ' fresh' : '')}>
              {body}
            </Link>
          ) : (
            <div key={n.id} className={'ntfrow' + (n.unread ? ' fresh' : '')}>{body}</div>
          );
        })}

        {list.length > 0 && (
          <p className="ntffoot">
            Replies, messages and mentions. Nothing else — there are no
            likes here, and there never will be.
          </p>
        )}
      </div>
    </>
  );
}
