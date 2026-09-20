'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
/* The lists live in a plain file so the SERVER page can import them too —
   see lib/look.js for why that matters. */
import { COVERS, ACCENTS, BLOCKS, normaliseSections } from '../../lib/look';

/* =====================================================================
   MAKE IT YOURS — the member dresses their own page. 20 Sept.

   🔴 THIS IS THE FEATURE ThemePicker PROMISED AND NEVER WAS. That control
   offered eight "themes", seven of which had no stylesheet, and it wrote
   to the `theme` column that Night already owns — the debt written down
   in ProfileBits.jsx ("if the public skins are ever built, they get their
   own column; do not add a ninth value here"). They do, and it did:
   0182 adds cover, accent and sections. ThemePicker is gone from /me.

   🔴 A LOOK TRAVELS WITH THE PAGE, NEVER WITH THE POST. Same rule as the
   old themes note: if a colour rode along with somebody's posts, an
   anonymous post would carry their fingerprint and somebody would match
   "the amethyst one" to a profile. The wall stays green for everybody.

   ⚠️ EVERY CHOICE IS FROM A SET WE DESIGNED, AND THAT IS THE WHOLE SAFETY
   ARGUMENT. Ty's call, 20 Sept. A free colour picker means a member can
   make their own page unreadable — grey on grey, or a 1.4 contrast that
   a screen reader user cannot see at all — and they would not know they
   had. Six covers and six colours, each measured against the card and
   the page, in the light app and in Night. The database agrees: the
   check constraints in 0182 reject anything not on these lists, so a
   bad value cannot arrive even if this file is wrong.

   ⚠️ THE CLASS PREFIX IS `lookp-`, NOT `lk-`. `.lk` has been the class
   on a link inside a post since 23 Aug — underlined, green, and styled
   in wall.css, which every page loads. A picker rooted at `.lk` came
   out underlined throughout and nobody would have guessed why. Grep
   before you pick a prefix; short ones are always taken.

   ⚠️ ARROWS, NOT DRAG. The prototype showed drag handles. Dragging on a
   phone fights the page scroll and is invisible to a screen reader; the
   up/down buttons do the same job for everybody. If drag is added later
   it goes BESIDE these, never instead of them.
   ===================================================================== */

export default function LookPicker({ profile }) {
  const [cover, setCover] = useState(profile.cover || 'none');
  const [accent, setAccent] = useState(profile.accent || 'green');
  const [rows, setRows] = useState(normaliseSections(profile.sections));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  async function save(patch, said) {
    setBusy(true); setErr(''); setNote('');
    try {
      const supabase = browserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      setNote(said);
    } catch (e) {
      /* The member's page, the member's words — same rule as save() in
         Me.jsx. They never see a Postgres constraint name. */
      setErr('That didn’t save. Try again in a second.');
    }
    setBusy(false);
  }

  function move(i, by) {
    const next = rows.slice();
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    save({ sections: next }, 'Saved.');
  }
  function toggle(i) {
    const next = rows.map((r, n) => (n === i ? { ...r, on: !r.on } : r));
    setRows(next);
    save({ sections: next }, 'Saved.');
  }

  const label = (k) => BLOCKS.find((b) => b.k === k) || { n: k, d: '' };

  return (
    <div className="lookp">
      <h3 className="pushh">Your cover</h3>
      <div className="lookp-covers">
        {COVERS.map((c) => (
          <button key={c.k} type="button" disabled={busy}
                  className={'lookp-cov' + (cover === c.k ? ' sel' : '')}
                  aria-pressed={cover === c.k}
                  style={c.css === 'none' ? undefined : { backgroundImage: c.css }}
                  onClick={() => { setCover(c.k); save({ cover: c.k }, 'Saved.'); }}>
            <span>{c.n}</span>
          </button>
        ))}
      </div>

      <h3 className="pushh" style={{ marginTop: 18 }}>Your colour</h3>
      <div className="lookp-dots">
        {ACCENTS.map((a) => (
          <button key={a.k} type="button" disabled={busy}
                  className={'lookp-dot' + (accent === a.k ? ' sel' : '')}
                  aria-label={a.n} aria-pressed={accent === a.k}
                  style={{ background: a.c }}
                  onClick={() => { setAccent(a.k); save({ accent: a.k }, 'Saved.'); }} />
        ))}
      </div>
      <p className="hint">
        Every colour here has been checked to stay readable, in the app and in Night.
      </p>

      <h3 className="pushh" style={{ marginTop: 18 }}>What shows, and in what order</h3>
      <ul className="lookp-rows">
        {rows.map((r, i) => (
          <li key={r.k} className={'lookp-row' + (r.on ? '' : ' off')}>
            <span className="lookp-txt">
              <b>{label(r.k).n}</b>
              <small>{label(r.k).d}</small>
            </span>
            <button type="button" className="lookp-mv" disabled={busy || i === 0}
                    aria-label={`Move ${label(r.k).n} up`} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="lookp-mv" disabled={busy || i === rows.length - 1}
                    aria-label={`Move ${label(r.k).n} down`} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className={'lookp-sw' + (r.on ? ' on' : '')} disabled={busy}
                    role="switch" aria-checked={r.on}
                    aria-label={`Show ${label(r.k).n}`} onClick={() => toggle(i)} />
          </li>
        ))}
      </ul>
      <p className="hint">
        Your bio, your town and your interests have their own switches further up
        this page. Your name, handle and days stay where they are.
      </p>

      {note && <p className="ok" role="status">{note}</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
