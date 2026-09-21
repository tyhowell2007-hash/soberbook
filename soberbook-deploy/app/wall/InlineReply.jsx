'use client';

import { useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { sendComment } from '../../lib/send-comment';
import { useTagBox } from '../components/TagBox';

/* A real reply box on every post, in the place where "join in" used to
   be. It sends words here; the + and conversation link retain the full
   sheet for photos, emoji, reply hearts and moderation.

   ⚠️ This component receives `people` from Wall rather than calling
   taggable_members() for itself. Sixty posts must not become sixty copies
   of the same database request just because each one has a textarea. */
export default function InlineReply({ post, people = [], face = null, onSent, onOpen }) {
  const boxRef = useRef(null);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: '', text: '' });

  /* Exactly the same matching/menu code as the full reply sheet. An
     anonymous reply deliberately gets no suggestion menu and can never
     offer @highlight, matching the safeguards in Thread.jsx. */
  const tag = useTagBox({
    text,
    setText,
    boxRef,
    people,
    enabled: !anon,
    canHighlight: !anon,
  });

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;

    setBusy(true);
    setStatus({ kind: '', text: '' });
    try {
      /* Create the client only when this one box sends. Calling it during
         render would make a full wall construct up to sixty clients just
         because sixty fields are visible. */
      const supabase = browserClient();
      const sent = await sendComment({
        supabase,
        postId: post.id,
        body,
        anonymous: anon,
        handles: tag.handles,
      });

      setText('');
      setActive(false);
      if (boxRef.current) boxRef.current.style.height = '';
      if (sent?.notice) setStatus({ kind: 'note', text: sent.notice });
      await onSent?.(post.id);
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error?.message || 'That reply did not post. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  const hasDraft = !!text.trim();
  const fullLabel = post.comment_count > 0
    ? (post.comment_count === 1 ? 'View the reply' : `View all ${post.comment_count} replies`)
    : 'More reply options';

  return (
    <div className={'qreply' + (active || hasDraft ? ' open' : '')}>
      {/* Above the field, never over somebody's words. The shared menu can
          contain six 44px rows, so placing it inside the input row would
          make a narrow phone jump sideways. */}
      {tag.menu}
      {tag.highlighting && (
        <div className="athlnote">@highlight · everybody</div>
      )}

      <form className="qreply-form" onSubmit={send} aria-label={`Reply to ${post.display_name}`}>
        <span className="qreply-face" aria-hidden="true">
          {anon ? '🤫' : (face || '🌱')}
        </span>
        <textarea
          ref={boxRef}
          value={text}
          {...tag.inputProps}
          maxLength={2000}
          rows={1}
          className="qreply-box"
          onFocus={() => setActive(true)}
          /* Same grow rule as the full composer. Height is reset first so
             deleting lines makes the field smaller as well as typing lines
             making it larger. The CSS owns the ceiling on a wall card. */
          onInput={(e) => {
            e.target.style.height = 'auto';
            const style = getComputedStyle(e.target);
            const edge = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
            e.target.style.height = (e.target.scrollHeight + edge) + 'px';
          }}
          aria-label="Write a reply"
          placeholder={anon ? 'Reply anonymously…' : 'Write a comment…'}
        />
        <button
          type="button"
          className="qreply-more"
          onClick={onOpen}
          disabled={busy || hasDraft || anon}
          aria-label="Open the full conversation, photos and emoji"
          title={hasDraft || anon ? 'Post or clear this reply first' : 'More reply options'}
        >+</button>
        <button type="submit" className="qreply-send" disabled={busy || !hasDraft}>
          {busy ? '…' : 'Reply'}
        </button>
      </form>

      {(active || hasDraft || anon || post.comment_count > 0) && (
        <div className="qreply-tools">
          {(active || hasDraft || anon) && (
            <button
              type="button"
              className={'qreply-anon' + (anon ? ' on' : '')}
              aria-pressed={anon}
              onClick={() => setAnon((value) => !value)}
            >
              {anon ? '🤫 replying anonymously' : 'reply anonymously?'}
            </button>
          )}
          {!hasDraft && !anon && (
            <button type="button" className="qreply-thread" onClick={onOpen}>
              {fullLabel} · photo &amp; emoji
            </button>
          )}
        </div>
      )}

      {status.text && (
        <div
          className={'qreply-status ' + status.kind}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
