'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import SongPicker from './SongPicker';
import SongPlayer from '../components/SongPlayer';
import Milestones from '../components/Milestones';

/* The faces you can pick from.

   A FIXED LIST, not a free text box. A text field accepts anything —
   a paragraph, or something ugly spelled out in symbols — and whatever
   goes in renders at 60px on every post that person ever made, on other
   people's screens. Fifty-four choices is not a limitation worth
   arguing about; it's the moderation queue nobody has to staff.

   ⚠️ WHAT'S DELIBERATELY MISSING, and it isn't squeamishness:
   🥴 reads as drunk. 🥳 comes with a party hat. 🍻 🍷 🚬 💊 are obvious.
   Every one of those is a normal emoji somewhere else and a bad joke
   here, and the person it lands worst on is somebody four days in
   scrolling their first thread. */
const FACE_GROUPS = [
  { name: 'Faces',   items: ['🙂','😀','😎','😌','🙃','🤔','😴','🥲','😇','🫡','🤠','😤'] },
  { name: 'Animals', items: ['🐺','🦊','🐻','🦌','🦅','🦉','🐢','🐧','🐬','🐝',
                             '🦋','🐎','🐕','🐈','🐟','🦁','🐘','🦔'] },
  { name: 'Outside', items: ['🌱','🌿','🍀','🌵','🌻','🌲','🌊','🌙','☀️','⭐','🔥','🗻'] },
  { name: 'Things',  items: ['⚓','🧭','🕯','☕','📻','🎧','🎸','🥁','🎣','🎮','🚂','🛠'] },
];

function days(since) {
  if (!since) return null;
  return Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
}

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export default function Me({ email, profile, posts }) {
  const router = useRouter();
  const supabase = browserClient();

  const [privacy, setPrivacy] = useState(profile.privacy_mode);
  const [since, setSince] = useState(profile.sober_since || '');
  /* The whole song, as one object. It used to be two loose strings the
     member had to fill in by hand; now the search hands back all four
     fields at once and this just holds them until Save. */
  const [song, setSong] = useState({
    anthem_url: profile.anthem_url || null,
    anthem_title: profile.anthem_title || null,
    anthem_art: profile.anthem_art || null,
    anthem_preview: profile.anthem_preview || null,
    anthem_youtube: profile.anthem_youtube || null,
  });
  const [auto, setAuto] = useState(!!profile.autoplay_songs);
  const [note, setNote] = useState('');       // the one status line, shared
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  /* ---- the lifetime total ---- */
  const [lifetime, setLifetime] = useState(profile.lifetime_days || 0);
  const [showLife, setShowLife] = useState(!!profile.show_lifetime);
  /* 'no'  — nothing to ask
     'ask' — moved the date forward, we don't know why yet
     'run' — they said they started over; now naming the run's length */
  const [reset, setReset] = useState('no');
  const [runLen, setRunLen] = useState('');

  /* ---- the rest of the profile (0011) ---- */
  const [bio, setBio] = useState(profile.bio || '');
  const [town, setTown] = useState(profile.town || '');
  const [state, setState] = useState(profile.state || '');
  const [showLoc, setShowLoc] = useState(!!profile.show_location);
  const [programs, setPrograms] = useState(profile.programs || '');
  const [interests, setInterests] = useState(profile.interests || '');
  const [sponsor, setSponsor] = useState(profile.sponsor_status || 'private');

  /* ---- name and face (0012) ---- */
  const [dname, setDname] = useState(profile.display_name || '');
  const [avatar, setAvatar] = useState(profile.avatar || '');

  /* The face picker is CLOSED by default and shuts itself again the moment
     you choose. Fifty-four squares sitting open is most of the page, and
     the thing you actually came here to see — the card at the top showing
     how you look to everyone else — gets pushed off screen by the menu
     you use once.

     ⚠️ THE REF IS NOT DECORATION. When the panel closes, the button you
     just clicked stops existing. Browsers respond to focus disappearing by
     dumping it back to the top of the document, so a keyboard user picks a
     face and silently loses their place — they're suddenly tabbing through
     the masthead again with no idea why. Moving focus back to the opener
     is what makes it a menu instead of a trapdoor.

     Nothing here saves. Picking a face still only stages it; Save is still
     the thing that writes. Opening and closing a menu must never be the
     same gesture as committing. */
  const [faceOpen, setFaceOpen] = useState(false);
  const faceBtn = useRef(null);
  /* A counter, not a boolean. Two picks in a row would both set `true`,
     React would see no change, and the effect wouldn't run the second
     time — the focus would work once and then quietly stop. */
  const [refocus, setRefocus] = useState(0);

  /* ⚠️ THIS HAS TO BE useEffect, AND THE FIRST VERSION GOT IT WRONG.
     I originally called focus() inside requestAnimationFrame, shipped it,
     and then measured: focus landed on <body>. It looked right in the
     code and did nothing on the screen.

     The reason is that rAF and React run on different clocks. rAF fires
     before the next PAINT; React commits its DOM changes on its own
     schedule. So the callback fired while the old tree was still up, and
     whatever it focused got thrown away moments later.

     useEffect is the one hook that is guaranteed to run AFTER React has
     written to the DOM. That's the whole reason to reach for it here. */
  useEffect(() => {
    if (refocus) faceBtn.current?.focus();
  }, [refocus]);

  function pickFace(e) {
    setAvatar(avatar === e ? '' : e);
    setFaceOpen(false);
    setRefocus((n) => n + 1);
  }

  const anon = privacy === 'anonymous';
  const deetsDirty =
    bio !== (profile.bio || '') || town !== (profile.town || '') ||
    state !== (profile.state || '') || programs !== (profile.programs || '') ||
    interests !== (profile.interests || '');

  const d = days(since);
  const today = new Date().toISOString().slice(0, 10);
  const savedSince = profile.sober_since || '';

  /* Moving the date FORWARD is the only shape that can mean a relapse:
     it's the only edit that takes days away. Moving it backward is
     somebody claiming MORE time — a correction, never a loss — so it
     saves silently and is never questioned.

     ⚠️ Compared as strings on purpose. These are 'YYYY-MM-DD', which
     sorts correctly as text, and building Date objects here would drag
     in the browser's timezone: `new Date('2026-08-09')` is midnight UTC,
     which in Ohio is the evening of the 8th. Two dates that differ only
     by that shift would compare wrong for a few hours a day — the kind
     of bug that reproduces at 9pm and never at noon. */
  const movedForward = !!savedSince && !!since && since > savedSince;

  /* The pre-filled guess: the gap between the old date and the new one.
     This is an UPPER bound, because part of that gap was the relapse
     itself, and only they know where the line was. So it is a starting
     number in an editable box, never a fact we assert. The alternative
     was asking somebody to type the date they relapsed, and nobody
     should have to timestamp the worst week of their year to use a
     settings page. */
  const guess = movedForward
    ? Math.max(0, Math.round((new Date(since + 'T00:00:00')
        - new Date(savedSince + 'T00:00:00')) / 86400000))
    : 0;

  const totalNow = lifetime + (d || 0);

  /* One save function for every setting on this page. `patch` is just an
     object of columns → new values.

     ⚠️ THE .eq() IS NOT OPTIONAL, AND I LEARNED THAT THE HARD WAY.

     I originally left it out and argued it was redundant: RLS already
     restricts every UPDATE to your own row, so a filter would be a comment
     rather than a control. That security reasoning is correct — and it is
     also not the layer that matters here.

     PostgREST refuses ANY update without a filter:

         UPDATE requires a WHERE clause

     It's a blanket guard against someone accidentally rewriting a whole
     table, and it fires before your database rules ever get consulted. So
     the save silently failed for two days: privacy toggle, sober date, and
     song, all of them.

     THE LESSON: "the database would stop it anyway" is an argument about
     safety. It is not an argument about whether the request is well-formed.
     Two different questions, two different layers, and being right about
     one told me nothing about the other. */
  async function save(patch, said) {
    setErr(''); setNote(''); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      setNote(said);
      router.refresh();          // so the Wall picks the change up
    } catch (e) {
      /* Translate the database's words into a person's.

         A constraint violation reads like
           new row violates check constraint "anthem_url_shape"
         which tells a member nothing and looks like the app broke. The
         check is doing exactly its job; it just doesn't speak English.

         Same principle as the block-RPC leak on Aug 6, pointed the other
         way: an error message is an output channel, so decide what it
         says instead of letting Postgres decide for you. */
      const m = String(e.message || '');
      if (m.includes('anthem_url_shape')) {
        setErr('That link isn’t one we can play. Use a share link from '
             + 'Spotify, YouTube or Apple Music — it should start with https://');
      } else if (m.includes('anthem_title_len')) {
        setErr('That title is a bit long — 120 characters or fewer.');
      } else if (m.includes('bio_len')) {
        setErr('That bio is over 200 characters.');
      } else {
        setErr(m);
      }
    } finally {
      setBusy(false);
    }
  }

  function choose(mode) {
    if (mode === privacy || busy) return;
    setPrivacy(mode);            // move the UI first — the toggle should feel instant
    save({ privacy_mode: mode },
         mode === 'open' ? 'Saved. Your name shows now.' : 'Saved. You are anonymous now.');
  }

  async function signOut() {
    if (!confirmOut) { setConfirmOut(true); return; }
    setBusy(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">you</span>
      </div>
      <div className="bar">Nothing here is public</div>

      <div className="pad">

        {/* ---- the count ---- */}
        <Milestones since={since || null} days={d}
                    sub={(d === 1 ? 'day' : 'days') + ' · @' + profile.handle} />

        {/* ---- name and face ---- */}
        <h2 className="sec">Your name and face</h2>

        <div className="pcard">
          <div className="pav" aria-hidden="true">{avatar || '🌱'}</div>
          <div className="pwho">
            <span className="pname">{anon ? profile.handle : (dname || profile.handle)}</span>
            <span className="phandle">@{profile.handle}</span>
          </div>
        </div>
        <p className="hint" style={{ marginTop: -12 }}>
          {anon
            ? 'You’re Anonymous, so people see your handle and the seedling — the name and face below are saved but not shown.'
            : 'This is exactly how your card looks to everybody else.'}
        </p>

        <label htmlFor="dn">What people call you</label>
        <input id="dn" type="text" maxLength={40} value={dname} disabled={busy}
               autoComplete="off"
               placeholder={profile.handle}
               onChange={(e) => setDname(e.target.value)} />
        <p className="hint">
          A first name or a nickname &mdash; whatever you&apos;d say in a room. Leave it
          empty and people just see @{profile.handle}, which is what everyone has been
          seeing until now.
        </p>

        <label id="facelab">Pick a face</label>
        {/* Why a fixed list and not a text box: see FACE_GROUPS up top.
            And no photographs here on purpose — a face on a recovery app
            is permanent and screenshot-able. That option is coming, but
            it gets built carefully rather than bolted on. */}
        <button type="button" className={'facepick' + (faceOpen ? ' open' : '')}
                ref={faceBtn}
                aria-expanded={faceOpen}
                aria-controls="facegrid"
                aria-labelledby="facelab"
                disabled={busy}
                onClick={() => setFaceOpen(!faceOpen)}>
          <span className="fpnow" aria-hidden="true">{avatar || '🌱'}</span>
          <span className="fplab">
            {avatar ? 'This is your face' : 'No face picked yet'}
            <span className="fpsub">
              {faceOpen ? 'Close without changing it'
                        : avatar ? 'Tap to pick a different one'
                                 : 'Tap to pick one — the seedling is the default'}
            </span>
          </span>
          <span className="fpcaret" aria-hidden="true">{faceOpen ? '▲' : '▼'}</span>
        </button>

        {faceOpen && (
          <div id="facegrid" className="facegrid">
            {FACE_GROUPS.map((g) => (
              <div key={g.name}>
                <h3 className="facegrp">{g.name}</h3>
                <ul className="faces">
                  {g.items.map((e) => (
                    <li key={e}>
                      <button type="button"
                              className={'face' + (avatar === e ? ' sel' : '')}
                              aria-label={'Use this as your face'}
                              aria-pressed={avatar === e}
                              disabled={busy}
                              onClick={() => pickFace(e)}>
                        <span aria-hidden="true">{e}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {/* The way back out. Tapping your own face again also clears it,
                but nobody discovers that, and "how do I undo this" is not a
                puzzle worth setting on a page about how you appear to
                people. */}
            {avatar && (
              <button type="button" className="facenone" disabled={busy}
                      onClick={() => pickFace(avatar)}>
                Go back to the seedling
              </button>
            )}
          </div>
        )}

        <button className="btn" type="button"
                disabled={busy || (dname === (profile.display_name || '')
                                   && avatar === (profile.avatar || ''))}
                onClick={() => save({
                  display_name: dname.trim() || null,
                  avatar: avatar || null,
                  avatar_kind: avatar ? 'emoji' : 'none',
                }, 'Saved. That’s you now.')}>
          {busy ? 'Saving…' : 'Save name and face'}
        </button>

        <p className="hint">
          Photos are coming, and they&apos;ll be your choice too &mdash; but a real face on
          a recovery app is permanent and easy to screenshot, so that one gets built
          carefully rather than quickly.
        </p>

        {/* ---- privacy ---- */}
        <h2 className="sec">How you show up</h2>
        <button type="button"
                className={'choice' + (privacy === 'open' ? ' sel' : '')}
                aria-pressed={privacy === 'open'} disabled={busy}
                onClick={() => choose('open')}>
          <span className="ct">🌱 Open</span>
          <span className="cd">Your name shows on anything you post normally.</span>
        </button>

        <button type="button"
                className={'choice dark' + (privacy === 'anonymous' ? ' sel' : '')}
                aria-pressed={privacy === 'anonymous'} disabled={busy}
                onClick={() => choose('anonymous')}>
          <span className="ct">🤫 Anonymous</span>
          <span className="cd">Only your handle shows. No real name, to anyone.</span>
        </button>

        <p className="hint">
          This applies to your old posts too, not just new ones — switching to
          Anonymous pulls your name off things you already wrote. Posts you
          marked anonymous at the time stay anonymous either way.
        </p>

        {/* ---- sober date ---- */}
        <h2 className="sec">Your date</h2>
        <label htmlFor="sd">Sober since</label>
        <input id="sd" type="date" value={since} max={today} disabled={busy}
               onChange={(e) => { setSince(e.target.value); setReset('no'); }} />
        <p className="hint">
          Only used to count days. Leave it empty if you&apos;d rather not have a number.
        </p>

        {reset === 'no' && (
          <button className="btn" type="button" disabled={busy || since === savedSince}
                  onClick={() => {
                    if (movedForward) { setRunLen(String(guess)); setReset('ask'); return; }
                    save({ sober_since: since || null },
                         since ? 'Date saved.' : 'Date cleared.');
                  }}>
            {busy ? 'Saving…' : 'Save date'}
          </button>
        )}

        {/* Two questions, never more, and neither of them asks what
            happened. The app does not need to know. */}
        {reset === 'ask' && (
          <div className="ask">
            <p className="askq">You moved your date forward. Which is it?</p>
            <button className="btn" type="button" disabled={busy}
                    onClick={() => setReset('run')}>
              I started over
            </button>
            <button className="btn ghost" type="button" disabled={busy}
                    onClick={() => { setReset('no');
                      save({ sober_since: since || null }, 'Date fixed.'); }}>
              I&apos;m just fixing the date
            </button>
            <p className="hint">
              Nothing you&apos;ve already done gets erased either way. This only
              decides whether those days get added to your total.
            </p>
          </div>
        )}

        {reset === 'run' && (
          <div className="ask">
            <p className="askq">How long was that run?</p>
            <label htmlFor="rl">Days</label>
            <input id="rl" type="number" inputMode="numeric" min="0" max="40000"
                   value={runLen} disabled={busy}
                   onChange={(e) => setRunLen(e.target.value)} />
            <p className="hint">
              We guessed from your old date. Change it if we got it wrong &mdash;
              you know where the line was and we don&apos;t.
            </p>
            <button className="btn" type="button" disabled={busy}
                    onClick={() => {
                      const add = Math.max(0, Math.min(40000, parseInt(runLen, 10) || 0));
                      const next = Math.min(40000, lifetime + add);
                      setLifetime(next);
                      setReset('no');
                      save({ sober_since: since || null, lifetime_days: next },
                           'Saved. Those ' + add.toLocaleString()
                           + ' days are yours for good.');
                    }}>
              {busy ? 'Saving…' : 'Add it and save'}
            </button>
            <button className="nvm" type="button" disabled={busy}
                    onClick={() => setReset('ask')}>
              back
            </button>
          </div>
        )}

        {/* ---- the total ---- */}
        {lifetime > 0 && (
          <>
            <div className="total">
              <span className="tn">{totalNow.toLocaleString()}</span>
              <span className="tl">days total, all of it</span>
            </div>
            <p className="hint">
              This number only ever goes up. Starting over resets the count
              at the top of this page; it has never once reset this one.
            </p>
            <button type="button"
                    className={'choice' + (showLife ? ' sel' : '')}
                    aria-pressed={showLife} disabled={busy}
                    onClick={() => { const n = !showLife; setShowLife(n);
                      save({ show_lifetime: n }, n
                        ? 'Your total is on your page now.'
                        : 'Hidden. Only you can see it.'); }}>
              <span className="ct">{showLife ? '👁 On your page' : '🔒 Just for you'}</span>
              <span className="cd">
                {showLife
                  ? 'Anyone visiting your page sees your total as well as your count.'
                  : 'Nobody but you sees this number.'}
              </span>
            </button>
            <p className="hint">
              Worth knowing before you flip it: a total bigger than your
              current count tells anyone who does the subtraction that you
              started over once. That&apos;s yours to share, not ours &mdash; which
              is why it&apos;s off until you say so.
            </p>
          </>
        )}

        {/* ---- about you ---- */}
        <h2 className="sec">About you</h2>

        {/* One notice, stated once, rather than the same warning stapled
            to five fields. If none of this shows, say so plainly and
            offer the one tap that changes it — don't just grey things
            out and let somebody wonder why they typed for nothing. */}
        {anon && (
          <div className="err">
            You&apos;re set to Anonymous, so none of this shows anywhere —
            your page carries your handle, your count and your song, and
            nothing else. You can still fill it in and it&apos;ll be waiting
            if you ever switch to Open.
          </div>
        )}

        <label htmlFor="bio">A line about you</label>
        <textarea id="bio" rows={3} maxLength={200} value={bio} disabled={busy}
                  placeholder="In recovery and open about it. Here to make real friends."
                  onChange={(e) => setBio(e.target.value)} />
        <p className="hint">{200 - bio.length} characters left.</p>

        <label htmlFor="prog">Your programs</label>
        <input id="prog" type="text" maxLength={120} value={programs} disabled={busy}
               placeholder="AA · SMART · MAT friendly"
               onChange={(e) => setPrograms(e.target.value)} />
        <p className="hint">
          However you word it. All paths count here, and nobody has to justify theirs.
        </p>

        <label htmlFor="int">What you&apos;re into</label>
        <input id="int" type="text" maxLength={120} value={interests} disabled={busy}
               placeholder="Fishing · Gaming · Podcasts"
               onChange={(e) => setInterests(e.target.value)} />
        <p className="hint">
          The thing people actually message you about. Worth more than the rest of this put together.
        </p>

        <button className="btn" type="button" disabled={busy || !deetsDirty}
                onClick={() => save({
                  bio: bio.trim() || null,
                  programs: programs.trim() || null,
                  interests: interests.trim() || null,
                  town: town.trim() || null,
                  state: state.trim() || null,
                }, 'Saved.')}>
          {busy ? 'Saving…' : 'Save'}
        </button>

        {/* ---- where you are ---- */}
        <h2 className="sec">Where you are</h2>
        <div className="tworow">
          <div>
            <label htmlFor="town">Town</label>
            <input id="town" type="text" maxLength={60} value={town} disabled={busy}
                   placeholder="Cadiz" onChange={(e) => setTown(e.target.value)} />
          </div>
          <div>
            <label htmlFor="st">State</label>
            <input id="st" type="text" maxLength={40} value={state} disabled={busy}
                   placeholder="Ohio" onChange={(e) => setState(e.target.value)} />
          </div>
        </div>

        <button type="button"
                className={'choice' + (showLoc ? ' sel' : '')}
                aria-pressed={showLoc} disabled={busy}
                onClick={() => { const n = !showLoc; setShowLoc(n);
                  save({ show_location: n }, n
                    ? 'On. Your town shows on your page.'
                    : 'Off. Nobody sees where you are.'); }}>
          <span className="ct">{showLoc ? '📍 Showing your town' : '🔒 Town hidden'}</span>
          <span className="cd">
            {showLoc
              ? 'Anyone who opens your page sees the town you typed.'
              : 'Saved, but not shown to anyone.'}
          </span>
        </button>
        <p className="hint">
          Off by default, and worth a thought before you turn it on. A handle,
          a day count and a small town is close enough to a name that somebody
          could work out who you are &mdash; and in a town this size, that might
          be your boss. Big city, much less of a problem.
        </p>

        {/* ---- sponsoring ---- */}
        <h2 className="sec">Sponsoring</h2>
        <button type="button"
                className={'choice' + (sponsor === 'available' ? ' sel' : '')}
                aria-pressed={sponsor === 'available'} disabled={busy}
                onClick={() => { const n = sponsor === 'available' ? 'private' : 'available';
                  setSponsor(n);
                  save({ sponsor_status: n }, n === 'available'
                    ? 'Saved. You show as available.'
                    : 'Saved. Taken back off your page.'); }}>
          <span className="ct">
            {sponsor === 'available' ? '🛟 Available to sponsor' : '🤝 Not sponsoring right now'}
          </span>
          <span className="cd">
            {sponsor === 'available'
              ? 'Your page tells people you have room for somebody.'
              : 'Nothing about sponsoring shows on your page.'}
          </span>
        </button>
        {sponsor === 'available' && d !== null && d < 365 && (
          <p className="hint">
            Saved &mdash; but it won&apos;t show on your page until you&apos;ve got a
            year, which is {(365 - d).toLocaleString()} days away. That&apos;s the
            same line the rooms draw, and it&apos;s here for the person on the
            other end of it: the people most likely to say yes to an offer
            like this are the ones with the least time.
          </p>
        )}

        {/* ---- your song ---- */}
        <h2 className="sec">Your song</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          The one that got you through. It plays on your page —{' '}
          <Link href={`/u/${profile.handle}`}>see how it looks</Link>.
        </p>

        <SongPicker value={song} onPick={setSong} disabled={busy} />

        {/* Hear it before you commit to it.

            `key` forces a brand-new player whenever the pick changes.
            Without it React reuses the same <audio> element, and the
            audio pipeline is built ONCE per element — so the old preview
            would keep playing underneath the new artwork. The props
            moved; the wiring didn't. */}
        {song.anthem_preview && (
          <SongPlayer key={song.anthem_preview} song={song} whose="preview" />
        )}

        <button className="btn" type="button"
                disabled={busy || song.anthem_url === (profile.anthem_url || null)
                          && song.anthem_youtube === (profile.anthem_youtube || null)}
                onClick={() => save(song, song.anthem_url
                  ? 'Song saved. It\u2019s on your page now.' : 'Song removed.')}>
          {busy ? 'Saving…' : 'Save song'}
        </button>

        {song.anthem_url && (
          <button className="nvm" type="button" disabled={busy}
                  onClick={() => setSong({ anthem_url: null, anthem_title: null,
                                           anthem_art: null, anthem_preview: null,
                                           anthem_youtube: null })}>
            take my song off my page
          </button>
        )}

        {note && <div className="ok">{note}</div>}
        {err && <div className="err">{err}</div>}

        {/* ---- autoplay ---- */}
        <h2 className="sec">When you visit someone</h2>
        <button type="button"
                className={'choice' + (auto ? ' sel' : '')}
                aria-pressed={auto} disabled={busy}
                onClick={() => { const n = !auto; setAuto(n);
                  save({ autoplay_songs: n }, n
                    ? 'On. Songs will start on their own.'
                    : 'Off. Nothing plays until you press it.'); }}>
          <span className="ct">{auto ? '🔊 Songs start on their own' : '🔇 Songs wait for you'}</span>
          <span className="cd">
            {auto
              ? 'When you open somebody\u2019s page their song begins playing.'
              : 'Nothing on this app makes a sound until you press play.'}
          </span>
        </button>
        <p className="hint">
          This is your setting, about your own ears &mdash; it has nothing to do with
          what happens when other people visit <em>you</em>. Off by default on
          purpose: a song you didn&rsquo;t ask for, coming out of a recovery app in a
          quiet room, tells whoever is nearby something you didn&rsquo;t choose to say.
        </p>

        {/* ---- your posts ---- */}
        <h2 className="sec">What you&apos;ve put up</h2>
        {posts.length === 0 ? (
          <p className="hint">Nothing yet. The wall is through the arrow up top.</p>
        ) : (
          <ul className="mine">
            {posts.map((p) => (
              <li key={p.id} className={p.is_anonymous ? 'screened' : ''}>
                <p className="mb">{p.body}</p>
                <div className="mm">
                  {ago(p.created_at)}
                  {p.is_anonymous ? ' · posted anonymously' : ''}
                  {p.comment_count > 0
                    ? ` · ${p.comment_count} ${p.comment_count === 1 ? 'reply' : 'replies'}`
                    : ' · no replies yet'}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ---- the door ---- */}
        <h2 className="sec">Account</h2>
        <p className="hint">Signed in as {email}</p>
        <button className={'btn out' + (confirmOut ? ' arm' : '')} type="button"
                disabled={busy} onClick={signOut}>
          {confirmOut ? 'Tap again to sign out' : 'Sign out'}
        </button>
        {confirmOut && (
          <button className="nvm" type="button" onClick={() => setConfirmOut(false)}>
            never mind
          </button>
        )}
      </div>
    </>
  );
}
