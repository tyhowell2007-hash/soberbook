import { saysHighlight } from './mentions';

/* =====================================================================
   ONE WRITE PATH FOR A REPLY.

   The wall now has two places that can send the same thing: the compact
   box under a post and the full conversation sheet. The database rules
   must not be copied between them. In particular:

     - the browser chooses the id because members may INSERT comments but
       may not read the base table back with RETURNING;
     - an empty photo list is NULL, never [], because the database check
       accepts either no list or a list containing one to ten paths;
     - mention notifications happen only after the reply is safely stored
       and can never turn a successful reply into a visible failure;
     - @highlight is attempted only for a named reply, matching the
       database rule that an anonymous announcement is refused.

   Keep those rules here. A new reply surface should call this function,
   not grow a third version of the insert in its component.
   ===================================================================== */

function notifyTagged(supabase, commentId, handles) {
  if (!handles || handles.length === 0) return;

  /* Deliberately detached from the send result. The comment already
     exists; a notification failure must not tell somebody their words
     were lost and tempt them to post the same reply twice. */
  void (async () => {
    try {
      await supabase.rpc('notify_mention_in', {
        p_kind: 'comment',
        p_id: commentId,
        p_handles: handles,
      });
    } catch {
      /* The saved reply remains the truth. */
    }
  })();
}

export async function sendComment({
  supabase,
  postId,
  body = '',
  anonymous = false,
  photoPaths = [],
  handles = [],
}) {
  const clean = body.trim();
  const paths = (photoPaths || []).filter(Boolean);
  if (!clean && paths.length === 0) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You seem to be signed out. Reload and try again.');

  const commentId = crypto.randomUUID();
  const { error } = await supabase.from('comments').insert({
    id: commentId,
    post_id: postId,
    author_id: user.id,
    body: clean || null,
    is_anonymous: anonymous,
    photo_urls: paths.length ? paths : null,
  });
  if (error) throw error;

  notifyTagged(supabase, commentId, handles);

  let notice = '';
  if (!anonymous && saysHighlight(clean)) {
    try {
      const { data: reached, error: highlightError } =
        await supabase.rpc('highlight_comment', { p_comment_id: commentId });

      if (highlightError) notice = `Replied. ${highlightError.message}`;
      else if (reached > 0) {
        notice = `Replied, and everybody was told — ${reached} members.`;
      }
    } catch {
      /* The reply is already saved. Say exactly which secondary action
         could not be confirmed instead of making the whole send look bad. */
      notice = 'Replied. The @highlight notice could not be confirmed.';
    }
  }

  return { commentId, notice };
}
