/* =====================================================================
   SAY IT IN ENGLISH.  7 Sept.

   One function that turns whatever the database threw into a sentence a
   person can act on. Every surface that shows a member an error calls
   this; nothing calls `setErr(error.message)` any more.

   ---------------------------------------------------------------------
   ** THE RULE THAT MAKES THIS SAFE, AND IT IS THE WHOLE DESIGN:

       IF WE WROTE THE MESSAGE, SHOW IT. IF POSTGRES WROTE IT, DON'T.

   Every deliberate `raise exception` in this schema comes back as
   SQLSTATE P0001 and is already written for a human -- "You can host a
   meeting once you have 90 days.", "That is not one of the choices.",
   "No video in an anonymous room -- a video carries your voice." All 46
   of them were checked; not one names a table or a column. Those pass
   through untouched, because a hand-written refusal is better than any
   generic sentence we could swap in.

   Everything else -- a CHECK constraint tripping, a unique violation, a
   permission denial -- is written BY POSTGRES, for a developer, and
   names the schema. Those get replaced.

   ---------------------------------------------------------------------
   !! WHY THIS MATTERS AND HOW IT WAS FOUND. Measured on the live schema,
   as a real member, not guessed:

     set_my_higher_power('x')      -> 23514 "new row for relation
                                     \"higher_powers\" violates check
                                     constraint \"higher_powers_body_check\""
     a sober date in the future    -> 22007 "sober_since cannot be in the
                                     future (got 2027-10-12, today is
                                     2026-09-07)"
     a 201-character bio           -> 23514 "... violates check constraint
                                     \"bio_len\""

   app/quiet/Wall.jsx and app/me/Me.jsx were handing those straight to
   the member. Quiet is the page where somebody writes about their
   daughter or their god; meeting a Postgres constraint name there is the
   app breaking character at the worst possible moment.

   ! THIS IS NOT AN ANONYMITY LEAK -- no other member's identity is in
   any of these strings. It is the same CATEGORY as the 6 Aug bug, where
   a constraint violation quoted `author_id` at signed-out callers, and
   that one WAS a leak. An error message is an output channel; the fix is
   to stop treating it as a debugging surface once it reaches a person.

   ---------------------------------------------------------------------
   ! AND THIS FILE IS THE ONLY IMPLEMENTATION, DELIBERATELY.
   explainProfileError() in lib/first-run.js now delegates here rather
   than keeping its own copy. A rule implemented twice is a rule that
   drifts -- 0046 -> 0047 -> 0049, and again in the craving list this
   morning where the client restated the database's dedupe rule and was
   wrong the day it was written.
   ===================================================================== */

/* Constraint name -> what to say. Keys are the real names, read out of
   pg_constraint, not invented. ! If a constraint is renamed, this map
   silently falls through to the safe default -- which is the right
   failure: a vague sentence, never a schema name. */
const BY_CONSTRAINT = {
  higher_powers_body_check: 'That needs to be between 2 and 280 characters.',
  bio_len:                  'That\u2019s a bit long \u2014 200 characters is the limit.',
  display_name_len:         'A display name can be up to 40 characters.',
  town_len:                 'A town name can be up to 60 characters.',
  state_len:                'That can be up to 40 characters.',
  interests_len:            'That can be up to 120 characters.',
  programs_len:             'That can be up to 120 characters.',
  profiles_path_other_len:  'That can be up to 80 characters.',
  anthem_title_len:         'A song title can be up to 120 characters.',
  /* ! These two came FROM Me.jsx's own translator. Folding them in here
     is what makes deleting that copy safe -- nothing this app already
     knew how to say is lost by centralising. */
  anthem_url_shape:         'That link isn\u2019t one we can play. Use a share link from Spotify, YouTube or Apple Music \u2014 it should start with https://',
  anthem_youtube_shape:     'That doesn\u2019t look like a YouTube link we can read.',
  handle_shape:             'Handles can use letters, numbers and underscores, three characters or more.',
  lifetime_days_sane:       'That number looks too big to be right.',
  comments_body_check:      'A reply needs at least one character, and up to 2,000.',
  posts_body_check:         'A post needs words, or a picture.',
  messages_body_check:      'A message needs at least one character, and up to 5,000.',
  room_messages_body_check: 'A message needs words or a picture.',
  craving_steps_shape:      'That list can hold up to six short lines.',
  survey_arrays_sane:       'That\u2019s more options than we can record.',
  survey_free_text_sane:    'That answer is longer than we can save.',
  drops_title_check:        'A title can be up to 120 characters.',
  drops_artist_check:       'An artist name can be up to 60 characters.',
  meeting_rooms_title_check:'A room name needs 3 to 60 characters.',
};

/* SQLSTATE -> what to say, when we can't name the field.
   ! 42501 is a PERMISSION denial. It deliberately does NOT say
   "you don't have permission" -- that tells somebody probing exactly what
   they learned. It reads as an ordinary failure. */
const BY_CODE = {
  '23505': 'Something with that name already exists. Try another.',
  '23503': 'That isn\u2019t there any more.',
  '23514': 'That doesn\u2019t fit \u2014 check the length and try again.',
  '22001': 'That\u2019s longer than we can save.',
  '22007': 'That date doesn\u2019t look right.',
  '22008': 'That date doesn\u2019t look right.',
  '42501': 'That didn\u2019t go through.',
  '40001': 'Two things happened at once. Try that again.',
};

const FALLBACK = 'That didn\u2019t save. Try once more, and if it keeps happening tell Ty.';

export function plainError(e, fallback) {
  if (!e) return fallback || FALLBACK;

  const code = String(e.code || e.sqlState || '');
  const raw  = String(e.message || '');

  /* ** OUR OWN REFUSALS PASS STRAIGHT THROUGH. P0001 is what plpgsql
     `raise exception` produces, and every one of ours is a sentence
     somebody wrote on purpose. Replacing "You can host a meeting once
     you have 90 days." with "That didn't save" would make the app
     stupider, not safer. */
  if (code === 'P0001') return raw;

  /* A named constraint is the most useful thing we can get -- it tells us
     exactly which field was wrong without showing anybody its name. */
  const named = raw.match(/violates check constraint "([a-z0-9_]+)"/i);
  if (named && BY_CONSTRAINT[named[1]]) return BY_CONSTRAINT[named[1]];

  /* The sober-date guard raises 22007 with the column name in the text.
     Caught here rather than left to the generic date line, because this
     is the single most reachable one: mistype the year on your own
     sober date and every other branch would have shown you the column. */
  if (/sober_since/i.test(raw)) {
    return /future/i.test(raw)
      ? 'That date is in the future \u2014 check the year.'
      : 'That date doesn\u2019t look right \u2014 check the year.';
  }

  if (BY_CODE[code]) return BY_CODE[code];

  /* !! THE DEFAULT NEVER ECHOES `raw`. If we get here we do not know what
     happened, and a string we don't understand is exactly the string
     most likely to be a schema dump. */
  return fallback || FALLBACK;
}

export default plainError;
