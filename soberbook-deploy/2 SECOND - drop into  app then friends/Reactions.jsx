'use client';

/* =====================================================================
   🫂 REACTIONS — the rooms.

   Ty, 29 Sept: "make it very emoji friendly."

   ⭐ WHY THIS EARNS ITS PLACE AND ISN'T DECORATION. When somebody posts
   "rough night, didn't drink, just sat with it," most people do not know
   what to type, so they say nothing. Silence under a message like that is
   the worst outcome this app has. A 🫂 is one tap and says the whole
   thing. That is the entire argument for this file.

   ---------------------------------------------------------------------
   ⚠️ EVERY RULE THE HEART ALREADY KEPT IS KEPT HERE. This replaces the
   ♥/♡ button, and losing one of its rules by writing something new is the
   failure mode:

     1. NEVER A ZERO. A pill appears only once its count is at least one.
        There is no "0" anywhere on this screen to feel bad about — same
        rule as the open-room card.
     2. YOUR OWN MESSAGE GETS NO BUTTON, only the counts, and only if
        somebody actually reacted. A message of yours that nobody answered
        looks like a message of yours, not like one with a zero beside it.
     3. OPTIMISTIC, AND THE SERVER'S ANSWER OVERWRITES THE GUESS rather
        than confirming it — two people reacting in the same second must
        land on the true number, not on our own +1.
     4. ON FAILURE THE ROW GOES BACK EXACTLY AS IT WAS. The database
        refuses your own message and anything you cannot see, so a refusal
        is a real answer, not a glitch to paper over.
     5. NOTHING WHILE A MESSAGE IS IN FLIGHT — there is no row on the
        server yet to react to.

   🔴 THE SIX ARE ALSO A DATABASE CONSTRAINT, not just this array.
   room_message_likes.emoji is CHECKed against exactly this set, and
   room_react() refuses anything else. The column is text and is shown to
   every other member, so without that constraint it is an unmoderated
   broadcast channel wearing a reaction's clothes. If you add a seventh
   here, add it there in the same commit or it will silently refuse.

   ⚠️ ONE REACTION PER PERSON PER MESSAGE — the primary key on
   room_message_likes is (message_id, user_id). Tapping a second emoji
   CHANGES yours, it does not add one. That keeps the count honest:
   "5 people hugged this", never 5 reactions from 2 people.

   ⚠️ NULL emoji means ❤️. The 123 rows written before 29 Sept predate the
   column, and every one of them was a heart.
   ===================================================================== */

export const REACTIONS = ['❤️', '👏', '🙏', '🫂', '🎉', '💚'];

const SAID = {
  '❤️': 'Heart this',
  '👏': 'Clap for this',
  '🙏': 'Thanks for this',
  '🫂': 'Send a hug',
  '🎉': 'Celebrate this',
  '💚': 'Green heart',
};

export default function Reactions({ counts, mine, isMine, pending, open, onOpen, onPick }) {
  if (pending) return null;

  const map = counts && typeof counts === 'object' ? counts : {};
  /* ⚠️ Only ever the six, in the order above — never Object.keys(map).
     A row written before a future rename would otherwise draw itself. */
  const shown = REACTIONS.filter((e) => (map[e] || 0) > 0);

  /* Your own message: the counts, and only if there are any. No button. */
  if (isMine) {
    if (shown.length === 0) return null;
    return (
      <div className="rxrow" aria-label="Reactions to your message">
        {shown.map((e) => (
          <span key={e} className="rxp on-mine">
            <span aria-hidden="true">{e}</span>
            <span className="rxn">{map[e]}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rxrow">
      {shown.map((e) => (
        <button
          key={e}
          type="button"
          className={'rxp' + (mine === e ? ' on' : '')}
          aria-pressed={mine === e}
          aria-label={
            mine === e
              ? `Take your ${e} back. ${map[e]} so far`
              : `${SAID[e] || 'React'}. ${map[e]} so far`
          }
          onClick={() => onPick(e)}
        >
          <span aria-hidden="true">{e}</span>
          <span className="rxn">{map[e]}</span>
        </button>
      ))}

      {/* ⭐ ALWAYS OFFERED on somebody else's message, even one nobody has
          answered — the way to reply without words has to be visible on
          exactly the messages that are hardest to answer. */}
      <button
        type="button"
        className={'rxadd' + (open ? ' open' : '')}
        aria-expanded={!!open}
        aria-label="React to this"
        onClick={onOpen}
      >
        <span aria-hidden="true">{shown.length ? '＋' : '🙂'}</span>
      </button>

      {open && (
        <div className="rxbar" role="group" aria-label="Pick a reaction">
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={'rxpick' + (mine === e ? ' on' : '')}
              aria-label={SAID[e] || e}
              onClick={() => onPick(e)}
            >
              <span aria-hidden="true">{e}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
