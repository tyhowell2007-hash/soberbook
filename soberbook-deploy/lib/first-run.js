/* =====================================================================
   FIRST RUN — CREATING THE PROFILE ROW. ONE PLACE, TWO CALLERS.

   Aug 27. Ty made a throwaway account, walked the real journey, and said
   it plainly: "the signing in portion is kinda fucking crazy. If I was a
   user I would probably not go through all that."

   He was right, and the count backs him up. A stranger met TWO screens
   and FIVE fields, two of which had to be invented on the spot — a
   password and a handle — before seeing a single post.

   ⭐ Now the handle is asked for on the SAME screen as the email and the
   password, already filled in, and the profile row is created the moment
   sign-up returns a session. One screen. Nothing to invent.

   ---------------------------------------------------------------------
   🔴 WHY THIS FUNCTION EXISTS INSTEAD OF A SECOND `insert`.

   /welcome still has to work — if e-mail confirmation is ever switched
   back on, sign-up returns NO session, there is nobody to create a
   profile for yet, and the person lands on /welcome after confirming.
   So two callers genuinely need to do this.

   Two callers, ONE implementation. This app has been bitten three times
   by the same shape — 0046, then 0047 restating the send cap, then 0049
   deleting the copy — and the note in 0049 is the rule: **a restatement
   is a second implementation, and the second one drifts.** The rules
   living in here are not cosmetic. `privacy_mode` defaults to anonymous
   so somebody who taps straight through ends up PROTECTED rather than
   exposed, and `display_name` is NULL rather than '' because an empty
   string counts as "has a name" everywhere that checks. If those drifted
   between two copies, one set of members would be quietly less safe than
   the other.
   ===================================================================== */

/* ⚠️ EVERY WORD IS DELIBERATELY NEUTRAL — places, weather, trees,
   objects. Nothing meaning sober, clean, new, reborn or day one, because
   a handle TRAVELS: it sits on every post, it is the address other
   members use, and somebody may well reuse it somewhere with nothing to
   do with recovery. A generated name must never be the thing that outs
   you.

   ⚠️ This list is the ONE copy. /welcome imports it from here rather than
   keeping its own — the safety property above is exactly the kind of
   thing that rots when there are two lists and only one gets edited. */
export const FIRST = ['River','Cedar','Gravel','Harbor','Willow','Copper','Marble',
  'Quarry','Lantern','Thistle','Autumn','Pine','Slate','Ember','Hollow',
  'Ridge','Birch','Anchor','Bramble','Iron','Amber','Dusty','North','Wren'];
export const SECOND = ['Road','Creek','Hill','Lane','Field','Porch','Bridge','Gate',
  'Ferry','Mill','Bend','Cove','Yard','Barn','Trail','Row','Grove','Landing',
  'Wharf','Bank','Fork','Rise','Way','Post'];

/* =====================================================================
   🔴 CLEAN A HANDLE AS IT IS TYPED — 30 AUG, AND IT COST US ELEVEN PEOPLE.

   `handle_shape` is `^[A-Za-z0-9_]{3,20}$`. No spaces, no dots, no
   hyphens, no apostrophes. The sign-up box accepted all of them, the
   account got created, and the profile insert was then refused by the
   database — leaving a person with a login and no account inside the app.

   Measured tonight: **11 auth users with no profile row.** Four of them
   existed for under a tenth of a second between sign-up and their last
   sight of us. That is not somebody losing their nerve; that is the very
   next step failing instantly.

   And the trigger is the most natural thing a person can type: their own
   name. "Mary Jane" fails. "mary.jane" fails. "O'Brien" fails.

   ⭐ THE FIX IS NOT A BETTER ERROR MESSAGE. There already was one, and it
   was decent. The fix is that the field can no longer hold something the
   database will refuse — the mistake is not available. A rule you have
   to remember is worse than a situation where the mistake cannot be made.

   ⚠️ A space becomes an underscore rather than vanishing, because
   somebody typing "Mary Jane" means two words and "MaryJane" quietly
   loses that. Everything else illegal is dropped. */
export function cleanHandle(raw) {
  return String(raw || '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 20);
}

export function makeHandles(n = 1) {
  const out = new Set();
  /* ⚠️ Bounded loop, not `while (out.size < n)`. With 24×24×90 names a
     collision is vanishingly unlikely, but an unbounded loop on a random
     generator is a hang waiting for a bad day. */
  for (let i = 0; i < n * 12 && out.size < n; i++) {
    out.add(FIRST[Math.floor(Math.random() * FIRST.length)]
          + SECOND[Math.floor(Math.random() * SECOND.length)]
          + (10 + Math.floor(Math.random() * 90)));
  }
  return [...out];
}

/* Both callers show a person a sentence, never a database string — the
   Aug 6 lesson, where a constraint violation quoted an author_id back to
   a caller with no account. An error message is an output channel.

   ⚠️ "Taken" and "reserved" deliberately produce the SAME advice. They
   are separate branches only so the wording stays natural, never so the
   difference leaks: knowing which of the two it is tells a stranger
   whether an account exists on that handle. */
export function explainProfileError(e) {
  const m = String((e && e.message) || '');
  if (/duplicate key|already exists|unique/i.test(m) || /reserved/i.test(m)) {
    return 'That handle isn’t available. Try another — or let us pick one.';
  }
  if (/handle/i.test(m) && /check|constraint|invalid/i.test(m)) {
    return 'Handles can use letters, numbers and underscores, three characters or more.';
  }
  return 'That didn’t save. Try once more, and if it keeps happening tell Ty.';
}

/**
 * Create the profile row for a signed-in user.
 *
 * 🔴 RETRIES ONLY ON A HANDLE COLLISION, AND ONLY WHEN WE PICKED THE
 * HANDLE. If the person typed it themselves, silently swapping it for a
 * different name would be worse than the error — this is the name
 * strangers in recovery will know them by. `generated` is what separates
 * "we chose this, so we may choose again" from "you chose this."
 */
export async function createProfile(supabase, {
  handle, name = '', since = '', privacy = 'anonymous', generated = false,
} = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, noSession: true };

  /* ⚠️ Cleaned HERE as well as in the box, and that is not belt-and-
     braces for its own sake: /welcome and /login both call this, and a
     third caller will exist eventually. The box stops a person seeing a
     refusal; this stops a caller that forgets to clean from creating
     another account with no profile. The last line of defence is the
     CHECK constraint, and by the time it speaks somebody is already
     locked out. */
  let h = cleanHandle(handle);
  if (h.length < 3) return { ok: false, message: 'A handle needs three characters or more — letters, numbers or underscores.' };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      handle: h,
      display_name: String(name || '').trim() || null,
      privacy_mode: privacy,
      sober_since: since || null,
    });
    if (!error) return { ok: true, handle: h };

    const collided = /duplicate key|already exists|unique|reserved/i.test(String(error.message || ''));
    if (collided && generated && attempt < 3) { h = makeHandles(1)[0]; continue; }
    return { ok: false, message: explainProfileError(error) };
  }
  return { ok: false, message: explainProfileError(new Error('unknown')) };
}
