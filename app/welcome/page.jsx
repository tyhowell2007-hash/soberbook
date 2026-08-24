'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

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
const FIRST = ['River','Cedar','Gravel','Harbor','Willow','Copper','Marble',
  'Quarry','Lantern','Thistle','Autumn','Pine','Slate','Ember','Hollow',
  'Ridge','Birch','Anchor','Bramble','Iron','Amber','Dusty','North','Wren'];
const SECOND = ['Road','Creek','Hill','Lane','Field','Porch','Bridge','Gate',
  'Bend','Mill','Yard','Barn','Path','Row','Ferry','Gap','Fork','Landing'];

function makeHandles(n = 3) {
  const out = new Set();
  /* A Set and a bail-out counter, not a while(true). If the word lists
     ever shrink to the point where n unique names aren't possible, an
     unbounded loop would hang the browser on the one page a nervous
     person is already halfway out of. */
  for (let i = 0; out.size < n && i < 60; i++) {
    const h = FIRST[Math.floor(Math.random() * FIRST.length)]
            + SECOND[Math.floor(Math.random() * SECOND.length)]
            + (10 + Math.floor(Math.random() * 90));
    if (h.length <= 20) out.add(h);
  }
  return [...out];
}

export default function Welcome() {
  const router = useRouter();
  const supabase = browserClient();
  const [handle, setHandle] = useState('');
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
      setErr('Pick a handle first — three characters or more. Tap “Suggest one for me” if nothing comes to mind.');
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

          <label htmlFor="h">Your handle</label>
          <input id="h" type="text" value={handle} minLength={3} maxLength={20}
                 pattern="[A-Za-z0-9_]{3,20}" autoComplete="off"
                 onChange={(e) => setHandle(e.target.value)} placeholder="RiverRoad88" />
          <p className="hint">Letters, numbers and underscores. This is what people see.</p>

          {/* THE BLANK-BOX FIX. Naming yourself is the hardest thing this
              page asks and the only thing it won't let you skip. */}
          <button type="button" className="nvm" onClick={() => setIdeas(makeHandles(3))}>
            {ideas.length ? 'Show me three more' : 'Suggest one for me'}
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
