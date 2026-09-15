'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   GRATITUDE - one line, every day.  15 Sept.  Migration 0154.

   A member asked for a gratitude list. Ty: "make it as simple as
   possible, make it its own thing, and people have to do it every day."
   He picked option B off three drawings: ONE LINE, NO NAMES, TODAY ONLY,
   and everybody's lines on one shared wall.

   ⭐ EVERY WORD OF THAT IS A REFUSAL, AND THE REFUSALS ARE THE FEATURE.

   ONE LINE. A gratitude JOURNAL is three bullets and a blank page, and a
   blank page at 6am is a thing to fail at. `gratitude_body_sane` caps the
   body at 200 characters in the database, so "keep it short" is not a
   placeholder anyone can ignore - it is the shape of the thing.

   TODAY ONLY. The primary key is (member_id, grateful_on). One row per
   person per day, enforced by the key and by nothing else - no app code
   anywhere checks for a duplicate, which is why there cannot be a bug
   where two slip through. Saying it twice REPLACES what you said; it
   does not stack up a list to scroll.

   🔴 NO STREAK, AND THAT IS THE WHOLE DIFFERENCE FROM THE PLEDGE. The
   pledge counts because a pledge is an INTENTION and an intention cannot
   be falsified. Gratitude is not an intention - some days there is
   nothing, and a counter that resets to zero on the day somebody could
   not find one thing is the app kicking a person who is already down.
   There is no streak column in 0154. Not hidden. Absent.

   🔴 NO NAMES ON THE WALL. gratitude_wall() returns TABLE(line text) and
   that is the entire shape - no handle, no member id, no timestamp. Not
   a view we filter down; a function that has nowhere to put a name.
   ⚠️ And it is ordered by md5(member_id || grateful_on), NOT by said_at -
   a wall sorted by time is a correlation vector, because somebody
   watching it at 6:02am learns which member just opened the app.

   🔴 NO HEART AND NO REPLY, same stance as Quiet. There is no likes
   table and no replies table for this, so adding one is a schema change
   and should feel like one. A wall where gratitude competes for hearts
   is a feed, and "grateful for my dog" losing to "grateful for 5 years"
   is the exact injury this is built to avoid.

   ⚠️ NO NOTIFICATION, EVER. 130 members were emailed "no reminders, no
   streaks, no nudges to come back" on 31 Aug. "People have to do it
   every day" means the card is here every day - it does not mean we
   chase anybody. The card has to earn the open, same cost the pledge
   pays.
   ===================================================================== */

/* ⚠️ Matches gratitude_body_sane in 0154: length(btrim(body)) between 1
   and 200. Restated here ONLY as a maxLength on the input, which is a
   convenience and not the rule - the database refuses 201 regardless, and
   was proven refusing it. If these two ever disagree, the database is
   right. (0046 -> 0049: a rule restated in two places drifts. This one is
   survivable because the second copy cannot say YES to anything the first
   says no to - it can only be politer.) */
const CAP = 200;

/* ⚠️ TWO PROPS AND BOTH ARE ABOUT WHERE THIS IS MOUNTED, NEVER ABOUT
   WHAT IT DOES. The card is byte-identical on Home and on /gratitude -
   one component, two mounts, exactly like Pledge.jsx. `wallLink` hides
   the "see what everybody put" link on the page that already IS the
   wall; `onChanged` lets that page redraw the wall when you add or
   remove your own line. Neither changes a rule. If a third prop ever
   starts changing behaviour, that is two components pretending to be
   one, and the second one drifts (0046 -> 0049). */
export default function Gratitude({ wallLink = true, onChanged }) {
  /* undefined = still asking the server. null = nothing said today.
     a string = what they said. ⚠️ Three states, not two: rendering the
     ask at somebody who already wrote this morning is the app forgetting
     them, and it is the first thing they would see. */
  const [mine, setMine] = useState(undefined);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(null);

  async function load() {
    const { data } = await browserClient().rpc('my_gratitude_today');
    setMine(typeof data === 'string' && data.length ? data : null);
  }

  useEffect(() => { load().catch(() => setMine(null)); }, []);

  async function say() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setRefused(null);
    try {
      await browserClient().rpc('gratitude_today', { p_body: text });
      await load();
      setBody('');
      setEditing(false);
      if (onChanged) onChanged();
    } catch (e) {
      /* 🔴 THE SCREEN (0151) RUNS ON THIS TABLE TOO, via gratitude_screen.
         When it refuses, it raises SB001 with a sentence written for a
         person - so we show what the database said rather than inventing
         "That didn't send. Try again", which on a screening refusal is
         FALSE: it did send, we refused it, and retyping the same words
         fails forever. That exact wrong message was the whole reason 0153
         existed. */
      setRefused((e && e.message) || 'That did not save. Try once more?');
    }
    setBusy(false);
  }

  async function takeItDown() {
    setBusy(true);
    try {
      await browserClient().rpc('undo_my_gratitude_today');
      await load();
      setEditing(false);
      setBody('');
      if (onChanged) onChanged();
    } catch { /* leave it up; a reload tells the truth */ }
    setBusy(false);
  }

  if (mine === undefined) return null;

  /* ---------------- nothing said today, or changing it ---------------- */
  if (mine === null || editing) {
    return (
      <div className="gr gr-ask">
        <p className="gr-eyebrow">Today</p>
        <p className="gr-head">One good thing.</p>
        {/* ⚠️ "one thing" is in the prompt AND the cap is in the database.
            The sentence is not decoration - it is what stops somebody
            typing three and having the fourth cut off mid-word at 200. */}
        <p className="gr-sub">
          What are you grateful for today? One thing is plenty.
        </p>
        <input
          className="gr-in"
          value={body}
          maxLength={CAP}
          onChange={(e) => { setBody(e.target.value); setRefused(null); }}
          placeholder="Grateful for..."
          /* ⚠️ Enter sends. One line, one key - reaching for a button
             after typing five words is friction on the one action this
             whole page exists to make effortless. */
          onKeyDown={(e) => { if (e.key === 'Enter') say(); }}
        />
        {refused && <p className="gr-refused">{refused}</p>}
        <div className="gr-row">
          <button type="button" className="gr-go"
                  disabled={busy || !body.trim()} onClick={say}>
            {busy ? 'One second...' : 'Add it'}
          </button>
          {/* Only offered when there is something to go back TO. */}
          {editing && mine !== null && (
            <button type="button" className="gr-quiet" disabled={busy}
                    onClick={() => { setEditing(false); setBody(''); setRefused(null); }}>
              Never mind
            </button>
          )}
        </div>
        {/* ⚠️ Said BEFORE they type, not after. Somebody deciding how much
            to say needs to know who reads it at the moment they decide.
            🔴 And it is the honest sentence, not "only you see this" -
            this one IS shared. The protection is that it carries no name,
            and that is exactly what the line claims and all it claims. */}
        <p className="gr-priv">
          Everybody sees the words. Nobody sees whose they are.
        </p>
      </div>
    );
  }

  /* ---------------- said it: the record for the rest of the day ------- */
  return (
    <div className="gr gr-done">
      <p className="gr-eyebrow">Today you said</p>
      <p className="gr-mine">&ldquo;{mine}&rdquo;</p>
      <div className="gr-row">
        <button type="button" className="gr-quiet" disabled={busy}
                onClick={() => { setBody(mine); setEditing(true); }}>
          Change it
        </button>
        {/* 🔴 A WAY BACK OFF THE WALL, and it is not optional. The line is
            already visible to 268 people by the time this renders; a
            member who wrote something they regret needs a control, not an
            email to Ty. undo_my_gratitude_today() deletes only the
            caller's own row for today - the identity test is in the WHERE
            clause, never a separate guard above it (6 Sept). */}
        <button type="button" className="gr-quiet" disabled={busy}
                onClick={takeItDown}>
          Take it down
        </button>
      </div>
      {wallLink && (
        <Link href="/gratitude" className="gr-wall-link">
          See what everybody put &rsaquo;
        </Link>
      )}
    </div>
  );
}
