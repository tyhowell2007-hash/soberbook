'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   THE SURVEY FORM. Kenny Kerns' idea, Sept 2026.

   Four questions. 172 members, 34 of whom have ever said anything —
   nobody has asked the other 138 what they came for.

   ⭐ THE VALUES STORED ARE STABLE KEYS, NOT THE LABELS ON SCREEN.
   'someone_told_me', not "Somebody I know told me about it". The wording
   will get tweaked; the counts must survive that. Rewording a label
   after answers exist would otherwise split one answer into two rows in
   survey_counts() and nobody would notice, because both rows look
   plausible.

   ⚠️ Q3 SWITCHES on the answer to Q2 — somebody who has posted is asked
   what made them, somebody who hasn't is asked what would help. Nobody
   scrolls past a question that isn't about them.
   ===================================================================== */

const FOUND = [
  ['someone_told_me',  'Someone told me'],
  ['facebook',         'Facebook'],
  ['poster',           'A poster or flyer'],
  ['meetings',         'Looking for meetings'],
  ['people_who_get_it','People who get it'],
  ['curious',          'Just curious'],
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
  const [firstTime, setFirst] = useState('');
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
  const empty = found.length === 0 && posted === null && !oneThing.trim();

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
      p_first_time:     posted === true ? firstTime : '',
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
        Four questions. Nothing here is tied to your name, and you can skip anything.
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
        {found.includes('curious') || found.length > 0 ? (
          <textarea className="sv-text sv-short" style={{ marginTop: 10 }}
            placeholder="Something else? (optional)"
            maxLength={400} value={other} onChange={e => setOther(e.target.value)} />
        ) : null}
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

      {posted === true && (
        <div className="sv-q">
          <p className="sv-ask">What made you, the first time?</p>
          <textarea className="sv-text" maxLength={2000}
            placeholder="However you want to put it."
            value={firstTime} onChange={e => setFirst(e.target.value)} />
        </div>
      )}

      <div className="sv-q">
        <p className="sv-ask">Anything you&rsquo;d add?</p>
        <p className="sv-hint">Optional.</p>
        <textarea className="sv-text" maxLength={2000}
          placeholder="A place for people with kids&hellip;"
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
