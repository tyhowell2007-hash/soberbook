'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';
/* The lists live in a plain file so the SERVER page can import them too —
   see lib/look.js for why that matters. */
import { COVERS, ACCENTS, BLOCKS, normaliseSections, coverCss, accentHex } from '../../lib/look';

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

export default function LookPicker({ profile, days = 0, name = '', avatar = '', avatarUrl = '',
                                    onLook = null }) {
  const router = useRouter();
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
      /* 🔴 20 SEPT — THE SAVE WORKED AND THE APP LOOKED BROKEN ANYWAY.
         Ty picked a cover and a colour, both landed in the database, and
         /u/<handle> still showed the old page: Next keeps a client-side
         cache of pages you have already visited, so walking back to your
         own profile re-renders the copy taken before the change. Nothing
         was wrong with the write; there was simply nothing anywhere on
         screen saying so.

         router.refresh() throws that cache away. Same call the avatar and
         the name saves further up Me.jsx already make, for the same
         reason — this one just didn't learn it until somebody hit it. */
      router.refresh();
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

  /* ⚠️ onLook is an ECHO, not the save. /me draws the same hero card at
     the top of the page, and without this it only caught up after the
     server round trip — you tapped a cover and the card two inches above
     your thumb sat still. The database write is still the one below. */
  const label = (k) => BLOCKS.find((b) => b.k === k) || { n: k, d: '' };

  return (
    <div className="lookp">
      {/* ===== THE PAGE, WHILE YOU CHANGE IT =====
          🔴 THE REASON THIS EXISTS. Without it the picker was a set of
          swatches that moved a tick and did nothing else: the change was
          three taps away on another screen, so a member who tried it
          concluded it was broken — which is exactly what happened the
          first time it shipped. A control for how something LOOKS has to
          show the thing it is changing.

          ⚠️ It is the real classes, not a drawing of them — `.uhero`,
          `.ucover`, `.pcard`, `.ucount` and `.count` are the same rules
          /u/[handle] renders, so this cannot drift away from the page it
          claims to preview. Change the hero there and this follows. */}
      <div className="uhero lookp-prev" style={{ '--acc': accentHex(accent) }}>
        <div className={'ucover' + (coverCss(cover) ? '' : ' flat')}
             style={coverCss(cover) ? { backgroundImage: coverCss(cover) } : undefined}
             aria-hidden="true" />
        <div className="pcard">
          {avatarUrl
            ? <img className="pav pav-photo" src={avatarUrl} alt="" aria-hidden="true" />
            : <div className="pav" aria-hidden="true">{avatar || '\u{1F331}'}</div>}
          <div className="pwho">
            <span className="pname">{name || '@' + profile.handle}</span>
            <span className="phandle">@{profile.handle}</span>
          </div>
        </div>
        <div className="ucount">
          <div className="count small">
            <div className="cn">{(days || 0).toLocaleString()}</div>
            <div className="cl">{days === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -8 }}>
        This is your page. It changes as you pick.
      </p>

      <h3 className="pushh">Your cover</h3>
      <div className="lookp-covers">
        {COVERS.map((c) => (
          <button key={c.k} type="button" disabled={busy}
                  className={'lookp-cov' + (cover === c.k ? ' sel' : '')}
                  aria-pressed={cover === c.k}
                  style={c.css === 'none' ? undefined : { backgroundImage: c.css }}
                  onClick={() => { setCover(c.k); if (onLook) onLook((l) => ({ ...l, cover: c.k }));
                                   save({ cover: c.k }, 'Saved.'); }}>
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
                  onClick={() => { setAccent(a.k); if (onLook) onLook((l) => ({ ...l, accent: a.k }));
                                   save({ accent: a.k }, 'Saved.'); }} />
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
