'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
import { makeHandles, createProfile } from '../../lib/first-run';

/* =====================================================================
   FIRST RUN.

   ⚠️ THIS PAGE HAS LOST AT LEAST ONE PERSON AND PROBABLY MORE.

   Aug 4: somebody confirmed their email, signed in, and left 38 seconds
   later without ever picking a handle. They are still in auth.users with
   no profile row, and they have never come back. That is somebody who
   got all the way through the hardest part — deciding to try a recovery
   app, giving an email, finding the confirmation — and then stopped on
   the doorstep.

   Three changes on Aug 16, in order of how much I think each one matters:

   1. THE HANDLE IS THE WALL. It is the only required field, it cannot be
      skipped, and it asks a person to invent an identity on the spot.
      That is a genuinely hard question, and it is harder here than
      anywhere else — this is the name strangers in recovery will know
      you by, and getting it wrong feels like being seen wrong. The
      placeholder "RiverRoad88" even sets a bar: oh, I'm supposed to be
      clever. So there is now a button that hands you three. Nobody has
      to face a blank box.

   2. THE REASON WAS UNDERNEATH THE WORK. The best sentence on this page —
      a post nobody answers gets BIGGER here — was at the bottom, below
      the form, where you only reach it after deciding to bother. It is
      now above the form. Reason first, work second.

   3. THE BUTTON WAS DEAD AND WOULDN'T SAY WHY. It was disabled until the
      handle reached three characters, with no explanation. A greyed-out
      button with no message reads as "this is broken" at least as often
      as "you missed something". It's always live now, and it tells you.

   ⚠️ WHAT DID NOT CHANGE, ON PURPOSE: privacy still defaults to
   'anonymous'. Someone who taps straight through without reading ends up
   protected rather than exposed. Same decision the schema makes in its
   column default, and the two must stay consistent.
   ===================================================================== */

/* Handle suggestions.

   ⚠️ EVERY WORD IN HERE IS DELIBERATELY NEUTRAL. Places, weather, trees,
   objects. Nothing that means sober, clean, new, reborn, day one, or
   anything else that broadcasts recovery status — because a handle
   travels. It sits on every post, it's the address other members use,
   and somebody may well use it somewhere that has nothing to do with
   this app. A generated name should never be the thing that outs you.

   Two words plus two digits: enough combinations that a collision is
   unlikely, and if one does happen the insert fails and says so. */
/* ⚠️ THE WORD LIST AND makeHandles() NOW LIVE IN lib/first-run.js.

   They used to be duplicated here. On Aug 27 the handle moved onto the
   front page so a new member fills ONE screen — which meant two files
   generating handles. 🔴 The rule those words encode is a SAFETY rule,
   not a style choice: nothing in the list may mean sober, clean, new or
   day one, because a handle travels and a generated name must never be
   the thing that outs somebody. A safety rule kept in two lists is a
   safety rule that rots the first time only one of them is edited.

   Same reason `createProfile` is shared: 0046 → 0047 → 0049 taught this
   app that a restatement is a second implementation, and the second one
   drifts. */

export default function Welcome() {
  const router = useRouter();
  const supabase = browserClient();
  /* 🔴 PRE-FILLED, NOT OFFERED. Aug 26.

     The Aug 16 pass added "Suggest one for me" and said "nobody has to
     face a blank box". They still did — the suggestion sat behind a
     button you had to DECIDE TO PRESS, which is its own small wall, and
     the placeholder "RiverRoad88" quietly set a bar: I'm supposed to be
     clever about this.

     ⭐ The audit that afternoon found NINE people with an account and no
     profile — and FIVE of them had signed in first. They reached this
     page, looked at it, and left. One had been stuck since Aug 4.
     **47% of everyone who ever tried to join Sober Book was behind this
     one screen.**

     ⭐ So the page no longer asks. It answers, and lets you disagree.
     A handle is already in the box when you arrive; changing it is one
     tap. The hardest question on the page became a default.

     ⚠️ Generated ON MOUNT, not on the server — a server-rendered default
     would be identical for two people arriving in the same second, and
     the second one would hit a duplicate-handle error on a name they
     never chose. */
  const [handle, setHandle] = useState('');

  /* ⚠️ Empty on the first render and filled immediately after, because
     makeHandles() uses Math.random() — doing it in useState's initialiser
     runs it on the SERVER too, and React then screams about the markup
     not matching. */
  useEffect(() => { setHandle(makeHandles(1)[0]); }, []);

  /* ⭐ THE NAME, ASKED HERE FOR THE FIRST TIME. Only 1 of 10 members has
     one, which is why "find people by name" searches an empty column —
     the field was buried in profile settings and nobody ever found it.
     This is where a person is already thinking about how they appear.

     ⚠️ Optional, and it says so. And it is the FIRST field, above the
     handle, because a real name is the easy question and answering an
     easy one makes the next one lighter. */
  const [name, setName] = useState('');
  const [since, setSince] = useState('');
  const [privacy, setPrivacy] = useState('anonymous');
  const [ideas, setIdeas] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setErr('');

    /* Validate here rather than by grbeying out the button. The person
       gets a sentence instead of a dead control. */
    const h = handle.trim();
    if (h.length < 3) {
      setErr('A handle needs three characters or more. Tap “Show me other options” if you’d rather we picked.');
      return;
    }

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      /* Hard navigation for the same two reasons as sign-out in Me.jsx:
         it clears the router cache, and it drops the green stylesheet so
         the door renders grunge. Soft-pushing here would leave /login
         wearing the green room's clothes. */
      if (!user) { window.location.assign('/login'); return; }

      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        handle: h,
        /* ⚠️ Trimmed, and NULL rather than '' when empty — an empty string
           would count as "has a name" everywhere that checks. */
        display_name: name.trim() || null,
        privacy_mode: privacy,
        sober_since: since || null,
      });
      if (error) throw error;
      router.push('/wall');
      router.refresh();
    } catch (e2) {
      const m = String(e2.message || '');
      /* ⚠️ "Taken" and "reserved" say the same thing to the person on the
         other end: not available, pick another. They're separate branches
         only so the wording can stay natural — never so the difference
         leaks. Knowing which of the two it is tells a stranger whether an
         account exists. */
      if (m.includes('profiles_handle_lower_idx')) setErr('That handle is taken. Try another.');
      else if (m.includes('reserved')) setErr('That handle isn’t available. Pick a different one.');
      else if (m.includes('handle_shape')) setErr('Handles are 3–20 characters: letters, numbers, underscore.');
      else setErr(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span></div>
      <div className="bar">All paths welcome — Suboxone included</div>
      <div className="pad">

        {/* MOVED TO THE TOP on Aug 16. This is the only thing on the page
            that answers "why bother", and it used to sit below the form
            where you reached it after doing the work. */}
        <div className="rule">
          <span className="rt2">One thing before you go in</span>
          <p>
            Everywhere else, a post nobody answers sinks and disappears.
            Here it does the opposite — <b>it gets bigger</b>, and keeps
            getting bigger, until somebody says something.
          </p>
          <p>
            That&apos;s the whole deal. Nobody posts into silence.
          </p>
        </div>

        <h1>How do you want to show up?</h1>
        <p className="sub">Your choice, and you can change it any time.</p>

        <form onSubmit={save}>
          <button type="button"
                  className={'choice' + (privacy === 'open' ? ' sel' : '')}
                  aria-pressed={privacy === 'open'}
                  onClick={() => setPrivacy('open')}>
            <span className="ct">🌱 Open</span>
            <span className="cd">Your name and picture show. Good if you&apos;re comfortable being seen.</span>
          </button>

          <button type="button"
                  className={'choice dark' + (privacy === 'anonymous' ? ' sel' : '')}
                  aria-pressed={privacy === 'anonymous'}
                  onClick={() => setPrivacy('anonymous')}>
            <span className="ct">🤫 Anonymous</span>
            <span className="cd">
              A handle and an icon. No real name, no face — not to other members,
              not to an employer. You can still post, comment, and message people.
            </span>
          </button>

          {/* ⚠️ The easy question first. Answering something simple makes
              the next box lighter, and this is the field that has been
              missing from every member but one. */}
          <label htmlFor="n">Your name — optional</label>
          <input id="n" type="text" value={name} maxLength={40} autoComplete="name"
                 onChange={(e) => setName(e.target.value)} placeholder="Leave blank to stay just a handle" />
          <p className="hint">
            Only shown if you chose Open above. Nobody can search for you by
            name unless you switch that on later.
          </p>

          <label htmlFor="h">Your handle</label>
          <input id="h" type="text" value={handle} minLength={3} maxLength={20}
                 pattern="[A-Za-z0-9_]{3,20}" autoComplete="off"
                 onChange={(e) => setHandle(e.target.value)} />
          <p className="hint">
            We picked this one for you — keep it or change it, whatever you
            like. Letters, numbers and underscores.
          </p>

          {/* ⚠️ Now says "another", not "suggest" — there is already one in
              the box. It is a refresh, not a rescue. */}
          <button type="button" className="nvm" onClick={() => setIdeas(makeHandles(3))}>
            {ideas.length ? 'Three more' : 'Show me other options'}
          </button>

          {ideas.length > 0 && (
            <div className="ideas">
              {ideas.map((i) => (
                <button key={i} type="button" className="idea"
                        onClick={() => { setHandle(i); setErr(''); }}>
                  {i}
                </button>
              ))}
              <p className="hint">Tap one to use it, or keep it as a starting point.</p>
            </div>
          )}

          <label htmlFor="d">Sober date — optional</label>
          <input id="d" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          {/* ⚠️ "or if you&apos;re here for somebody else" added Aug 17.

              This is the exact moment a person without a date decides
              whether they belong. Everything above this field assumes
              they're in recovery themselves; the mother of somebody
              using, or somebody who just wants to understand it, reaches
              this box and concludes they're in the wrong place.

              "Plenty of people are" is doing real work — it says you
              aren't the strange exception. Don't cut it for brevity.

              And note there is no follow-up question, no "who are you
              here for", no category to pick. Asking would turn a welcome
              into a form, and it would create the two-class room the
              chip comment in Directory.jsx exists to prevent. */}
          <p className="hint">
            We&apos;ll count your days and mark the milestones. Leave it blank if you&apos;d rather
            not, or if you&apos;re here for somebody else — plenty of people are. You can add it
            later, and nothing else depends on it.
          </p>

          {/* No longer disabled on handle length — see the note in save(). */}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Setting up…' : 'Come in'}
          </button>
        </form>

        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
