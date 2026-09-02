'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE SURVEY FORM. Kenny Kerns' idea, Sept 2026.

   183 members, 34 of whom have ever said anything — nobody has asked the
   other 149 what they came for.

   ⭐ THE VALUES STORED ARE STABLE KEYS, NOT THE LABELS ON SCREEN.
   'someone_told_me', not "Someone told me". The wording will get
   tweaked; the counts must survive that. Rewording a label after answers
   exist would otherwise split one answer into two rows in
   survey_counts() and nobody would notice, because both rows look
   plausible.

   ⚠️ Q3 IS SHOWN ONLY TO SOMEBODY WHO HASN'T POSTED. Ty, 2 Sept: "the
   important question is what would make it easier?" — so a member who
   says Yes goes straight to Q4 rather than being handed a blank box.
   🔴 The old Q3b ("what made you, the first time?") is DELETED, not
   hidden. It gave the 34 people who already talk an essay to write while
   the 149 silent ones got chips to tap — the easy group getting the hard
   question. `first_time` still exists as a column and survey_submit
   still takes the argument; nothing writes to it now. Leaving the
   parameter alone keeps one function signature rather than two.
   ===================================================================== */

/* Two groups, one question. 🔴 Ty, 2 Sept: "let's add all social medias
   to this as well" — Facebook was the only network listed while the app
   is being shared on Instagram and TikTok, so the answer we most needed
   was one nobody could give.

   ⚠️ THIRTEEN OPTIONS NEEDED A MIGRATION (0112). survey_arrays_sane
   capped found_us at 12, so a member ticking every box would have been
   refused by the database and told "That didn't send. Try once more?" —
   which would have been false, and would have hit precisely the person
   answering most generously. Adding an option here without checking that
   ceiling is the bug returning. */
const FOUND = [
  ['someone_told_me',  'Someone told me'],
  ['poster',           'A poster or flyer'],
  ['meetings',         'Looking for meetings'],
  ['people_who_get_it','People who get it'],
  ['curious',          'Just curious'],
];

/* ⚠️ Split out under its own label rather than dumped into one pile of
   thirteen chips. A wall of chips gets skimmed and the first one gets
   tapped — and the first one here is "Someone told me", which is the
   channel we already know works. Burying it would flatter it. */
const ONLINE = [
  ['facebook',     'Facebook'],
  ['instagram',    'Instagram'],
  ['tiktok',       'TikTok'],
  ['youtube',      'YouTube'],
  ['snapchat',     'Snapchat'],
  ['x',            'X'],
  ['reddit',       'Reddit'],
  ['other_online', 'Somewhere else online'],
];

const STOPPED = [
  ['say_hi',        'Somewhere to just say hi'],
  ['who_can_see',   'Knowing who can see what I write'],
  ['a_prompt',      'A prompt or a question to answer'],
  ['more_talking',  'Seeing more people talking first'],
  ['more_time',     "More time — just haven't got to it"],
];

export default function Form() {
  const [found, setFound]     = useState([]);
  const [posted, setPosted]   = useState(null);   // true | false | null
  const [stopped, setStopped] = useState([]);
  const [oneThing, setOne]    = useState('');
  const [other, setOther]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [done, setDone]       = useState(false);

  const toggle = (list, set, key) =>
    set(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);

  /* ⚠️ The button is never dead-without-explanation. The 16 Aug /welcome
     bug was a submit that did nothing and said nothing; here an empty
     form gets a sentence rather than silence. */
  const empty = found.length === 0 && posted === null && !oneThing.trim() && !other.trim();

  async function send() {
    if (empty) { setErr('Answer one thing first — anything at all.'); return; }
    setBusy(true); setErr('');
    const supabase = browserClient();
    const { error } = await supabase.rpc('survey_submit', {
      p_found_us:       found,
      p_found_us_other: other,
      p_has_posted:     posted,
      /* Only send the branch that was actually shown. */
      p_stopped_by:     posted === false ? stopped : [],
      p_stopped_other:  '',
      /* 🔴 Q3b is gone. The argument stays so the function keeps one
         signature — see the note at the top. */
      p_first_time:     '',
      p_one_thing:      oneThing,
    });
    setBusy(false);
    if (error) { setErr("That didn't send. Try once more?"); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="sv-wrap">
        <div className="sv-done">
          <div className="sv-tick" aria-hidden="true">✓</div>
          <p className="sv-dhead">Thank you</p>
          <p className="sv-dsub">That genuinely helps. It goes straight to what we build next.</p>
          <a className="sv-back" href="/wall">Back to the wall</a>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-wrap">
      <h1 className="sv-lede">We&rsquo;re still building this</h1>
      <p className="sv-sub">
        Three questions. Nothing here is tied to your name, and you can skip anything.
      </p>

      <div className="sv-q">
        <p className="sv-ask">What brought you here?</p>
        <p className="sv-hint">Pick any that fit.</p>
        <div className="sv-chips">
          {FOUND.map(([k, label]) => (
            <button key={k} type="button" className="sv-chip"
              aria-pressed={found.includes(k)}
              onClick={() => toggle(found, setFound, k)}>{label}</button>
          ))}
        </div>

        <p className="sv-group">Or from</p>
        <div className="sv-chips">
          {ONLINE.map(([k, label]) => (
            <button key={k} type="button" className="sv-chip"
              aria-pressed={found.includes(k)}
              onClick={() => toggle(found, setFound, k)}>{label}</button>
          ))}
        </div>

        {/* 🔴 ALWAYS SHOWN. This used to be hidden until you had already
            picked a chip, which locked out the one person whose whole
            answer is something we never thought of — the only answer here
            that can teach us anything new. */}
        <textarea className="sv-text sv-short" style={{ marginTop: 12 }}
          placeholder="Something else? (optional)"
          maxLength={400} value={other} onChange={e => setOther(e.target.value)} />
      </div>

      <div className="sv-q">
        <p className="sv-ask">Have you posted or replied yet?</p>
        <div className="sv-two">
          <button type="button" className="sv-opt" aria-pressed={posted === true}
            onClick={() => setPosted(true)}>Yes</button>
          <button type="button" className="sv-opt" aria-pressed={posted === false}
            onClick={() => setPosted(false)}>Not yet</button>
        </div>
      </div>

      {posted === false && (
        <div className="sv-q">
          <p className="sv-ask">What would make it easier?</p>
          <p className="sv-hint">Pick any that fit.</p>
          <div className="sv-opts">
            {STOPPED.map(([k, label]) => (
              <button key={k} type="button" className="sv-opt"
                aria-pressed={stopped.includes(k)}
                onClick={() => toggle(stopped, setStopped, k)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ⚠️ No "Optional." hint under this one, deliberately. It is the
          question the whole survey was Kenny's idea for; labelling it
          optional is the app telling people to skip it. */}
      <div className="sv-q">
        <p className="sv-ask">What else would you like to see in the app?</p>
        <textarea className="sv-text" maxLength={2000}
          placeholder="Anything. Big or small."
          value={oneThing} onChange={e => setOne(e.target.value)} />
      </div>

      <button className="sv-send" onClick={send} disabled={busy}>
        {busy ? 'Sending…' : 'Send it'}
      </button>
      {err && <p className="sv-err">{err}</p>}
      <p className="sv-foot">Your answers aren&rsquo;t linked to your account.</p>
    </div>
  );
}
