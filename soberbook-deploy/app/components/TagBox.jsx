'use client';

/* =====================================================================
   THE @ MENU, WRITTEN ONCE. 5 Sept.

   Ty: "Any room we have that you can type to somebody, they should be
   able to tag somebody."

   Before this, the menu lived in ONE composer — the Wall — as about
   ninety lines inline in Wall.jsx. A reply, the rooms and chat had
   nothing. The obvious fix was to paste those ninety lines into three
   more files, and it is the wrong fix for a reason this schema has
   already paid for three times:

   ⭐ 0046 fixed a bug caused by one rule being restated in two places,
   and its own note says "a restatement is a second implementation, and
   the second one drifts." Then 0047 changed one of them and not the
   other, and 0049 had to DELETE a copy rather than update it.

   Four copies of a tag menu is that mistake with a running start. So the
   menu is a hook, used by the reply sheet, both room composers and chat.

   🔴 BE HONEST ABOUT WHAT IS STILL DUPLICATED: Wall.jsx KEEPS ITS OWN
   INLINE COPY OF THIS MENU. It was not converted today.

   ⚠️ That is a considered call, not an oversight, and the distinction
   that makes it survivable is this: the RULE is not duplicated. Who an
   @name matches, what counts as ambiguous, where the caret is inside a
   word — all of that lives in lib/mentions.js, and the Wall and this
   hook both call it. What is duplicated is the MARKUP and the key
   handlers around it. 0046 was a rule restated in two places; this is a
   widget drawn in two places over one rule.

   ⚠️ The real cost is still real: change the menu's behaviour here and
   the Wall will not follow. If you are touching either one, do both, or
   finish the extraction. It is on the list.
   ⚠️ The Wall also needs `noteFor` when it moves — see below.

   ---------------------------------------------------------------------
   WHAT EACH SURFACE GETS, AND WHY THEY ARE NOT ALL THE SAME.

     Wall post    menu · @name links · a tag row in post_tags · notified
     Reply        menu · @name links ·                          notified
     Rooms        menu · @name links ·                          notified
     Chat         menu · @name links ·                      NOT notified

   🔴 CHAT IS DELIBERATELY NOT NOTIFIED, and 0131 carries the argument in
   full: the person you are talking to already gets a message
   notification, so the only NEW person an @ can name is a third party
   outside the conversation — and telling them "two people mentioned you
   in a private conversation" publishes the existence of a private
   conversation about them.

   🔴 AND ONLY THE WALL WRITES A TAG ROW. post_tags exists because a tag
   on a post is a durable public label with your name on it, attached by
   somebody else — hence a stranger's tag waits for approval (0082). An
   @name inside a sentence is just words somebody wrote. Nobody approves
   being referred to.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { activeQuery, suggest, buildIndex, findMentions } from '../../lib/mentions';
import { supabase } from '../../lib/supabase-browser';

/* One shared fetch of who can be tagged.

   ⚠️ taggable_members() returns EVERY member, not just friends — that has
   been true since 0082 and the Wall menu has always used it. The name
   `friends` survived from before that change; here it is called `people`
   because nothing about it is a friends list any more. */
export function useTaggablePeople(enabled = true) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    supabase.rpc('taggable_members')
      .then(({ data }) => { if (alive) setPeople(data || []); });
    return () => { alive = false; };
  }, [enabled]);
  return people;
}

/* ---------------------------------------------------------------------
   THE HOOK.

   Give it the text state and a ref to the input; it hands back the
   props to spread onto that input, the menu to render, and the handles
   the text currently names.

   ⚠️ `enabled` is false when the box is anonymous on the Wall. The menu
   must not appear there — an anonymous post cannot tag anyone at all
   (mentions_guard refuses it), so offering the menu would be a control
   that does nothing, which this project treats as worse than no control.
   --------------------------------------------------------------------- */
/* ⚠️ `noteFor` is the one thing that genuinely differs between surfaces,
   so it is a parameter rather than a branch inside the menu.

   On the WALL a tag writes a row in post_tags, and a stranger's tag waits
   for them to approve it (0082) — so the menu has to say so AT THE MOMENT
   OF CHOOSING, not let somebody discover afterwards that their post never
   showed the name they put on it.

   Everywhere else there is no approval and nothing to warn about, because
   there is no tag row at all — just words somebody wrote. The default note
   is the handle, which is the useful thing to see when two members have
   similar display names. */
const DEFAULT_NOTE = (f) => '@' + f.handle;

export function useTagBox({ text, setText, boxRef, people, enabled = true, noteFor = DEFAULT_NOTE }) {
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [dir, setDir] = useState([]);

  const q = enabled ? activeQuery(text, caret) : null;

  /* Everyone who is not already in memory, looked up as you type.

     ⚠️ Debounced, and an in-flight reply is dropped if the query moved on
     (`alive`). Without that a slow answer for "@da" can land after a fast
     answer for "@dan" and repopulate the menu with the wrong people under
     a caret that has already moved. */
  useEffect(() => {
    const t = ((q && q.typed) || '').trim();
    if (!enabled || t.length < 1) { setDir([]); return; }
    let alive = true;
    const timer = setTimeout(() => {
      supabase.from('public_profiles')
        .select('handle, display_name')
        .or(`handle.ilike.${t}%,display_name.ilike.${t}%`)
        .limit(8)
        .then(({ data }) => { if (alive) setDir(data || []); });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [q && q.typed, enabled]);

  /* Friends first, then everybody else, deduped by handle.

     ⚠️ The in-memory copy WINS on a collision — it carries is_friend, and
     the menu uses that to say whether a Wall tag lands straight away or
     has to be asked for. Letting the directory row win would silently
     relabel a friend as a stranger. */
  const options = (() => {
    if (!q) return [];
    const mine = suggest((people || []).map((f) => ({ ...f, isFriend: f.is_friend !== false })), q.typed);
    const seen = new Set(mine.map((f) => f.handle.toLowerCase()));
    const rest = suggest(
      (dir || []).filter((d) => !seen.has(d.handle.toLowerCase()))
                 .map((d) => ({ ...d, isFriend: false })),
      q.typed);
    return [...mine, ...rest].slice(0, 6);
  })();

  function choose(f) {
    if (!q) return;
    const label = f.display_name || f.handle;
    const next = text.slice(0, q.at) + '@' + label + ' ' + text.slice(caret);
    setText(next);
    const pos = q.at + 1 + label.length + 1;
    setPick(0);
    /* ⚠️ Put the caret back after the name. Without this it jumps to the
       end of the box, so tagging somebody mid-sentence throws you to the
       end of what you were writing. */
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (el) { el.focus(); el.setSelectionRange(pos, pos); setCaret(pos); }
    });
  }

  const index = buildIndex(people || []);
  const { found, ambiguous, unmatched } = findMentions(enabled ? text : '', index);

  /* 🔴 DON'T CORRECT SOMEBODY MID-WORD. Typing "@ni" used to put the menu
     up offering Nic AND print "nobody here goes by that" underneath at
     the same time. Both true; together they tell a person they are wrong
     while they are halfway through being right. */
  const inFlight = q ? (q.typed || '').toLowerCase() : null;
  const shownUnmatched = (unmatched || []).filter(
    (u) => u.toLowerCase() !== inFlight && u.toLowerCase() !== 'highlight');

  const inputProps = {
    /* ⚠️ The caret is read on EVERY interaction, not just on change.
       Tapping into the middle of what you already wrote moves the caret
       without changing a character — and the menu follows the caret, not
       the text. */
    onChange: (e) => { setText(e.target.value); setCaret(e.target.selectionStart); setPick(0); },
    onKeyUp: (e) => setCaret(e.target.selectionStart),
    onClick: (e) => setCaret(e.target.selectionStart),
    onBlur: () => setTimeout(() => setCaret(-1), 150),
    onKeyDown: (e) => {
      if (!options.length) return;
      /* ⚠️ Enter and Tab pick; they must not submit the form or jump to
         the Send button while a menu is open. */
      if (e.key === 'ArrowDown') { e.preventDefault(); setPick((i) => (i + 1) % options.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => (i - 1 + options.length) % options.length); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(options[pick]); }
      else if (e.key === 'Escape') { setCaret(-1); }
    },
  };

  /* ⚠️ Rendered by the CALLER, wherever it fits that layout. The Wall
     puts it under the composer; the rooms and chat put it ABOVE the bar,
     because their composer is pinned to the bottom of the screen and a
     menu below it would be off-screen behind the keyboard. */
  const menu = options.length > 0 ? (
    <div className="atmenu" role="listbox" aria-label="Tag somebody">
      {options.map((f, i) => (
        <button type="button" key={f.handle} role="option"
                aria-selected={i === pick}
                className={'atopt' + (i === pick ? ' on' : '')}
                /* ⚠️ onMouseDown, not onClick. A click fires after blur,
                   and blur closes the menu — so the button would be gone
                   before the click ever landed. */
                onMouseDown={(e) => { e.preventDefault(); choose(f); }}>
          <b>{f.display_name || f.handle}</b>
          <span>{noteFor(f)}</span>
        </button>
      ))}
    </div>
  ) : null;

  return {
    menu,
    inputProps,
    options,
    handles: (found || []).map((m) => m.handle),
    mentions: found || [],
    ambiguous: ambiguous || [],
    unmatched: shownUnmatched,
    setCaret,
  };
}

/* ---------------------------------------------------------------------
   TELLING THE PEOPLE WHO WERE NAMED.

   ⚠️ Swallowed on purpose, the same call previews, drops and tags all
   make: the message is already sent by the time this runs. Nothing here
   can lose it, and a red banner because a notification didn't fire is a
   worse screen than a missing notification.

   🔴 `id` is generated by the BROWSER and inserted with the row — it is
   never read back. Members hold INSERT on comments and room_messages and
   no SELECT, so a `RETURNING id` is refused with 42501: a RETURNING
   clause is a read. That is the 23 Aug rule, and this is its fourth
   appearance. Generating the id here is not a workaround, it is the
   correct shape — we need to KNOW the id, not be TOLD it.
   --------------------------------------------------------------------- */
export async function tellThemTheyWereTagged(kind, id, handles) {
  if (!id || !handles || !handles.length) return 0;
  try {
    const { data } = await supabase.rpc('notify_mention_in',
      { p_kind: kind, p_id: id, p_handles: handles });
    return data || 0;
  } catch {
    return 0;
  }
}
