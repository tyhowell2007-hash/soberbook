'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import SongPicker from './SongPicker';
import SongPlayer from '../components/SongPlayer';
import Milestones from '../components/Milestones';
import { dayCount, startsInDays } from '../../lib/milestones';
import PhotoUpload from '../components/PhotoUpload';
import DeleteAccount from './DeleteAccount';
import PushSwitch from '../components/PushSwitch';

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

/* ⚠️ There was a private days() here doing its own date maths — the third
   copy of dayCount(). It didn't clamp, so this page showed "-130" to a
   member whose sober date hadn't arrived. Deleted rather than fixed: a
   repaired copy is still a copy, and the next screen would drift too. */

function ago(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

/* =====================================================================
   ONE COLLAPSIBLE SECTION OF THE EDITOR.

   ⚠️ THIS IS <details>, NOT A useState TOGGLE, AND THAT IS THE POINT.

   The obvious build is `const [open,setOpen]=useState(false)` per
   section, or one `openSection` variable. Both are worse:

     · Nine pieces of state that can disagree with what's on screen.
     · Nothing works before the JavaScript loads. On a bad phone signal
       that's a page of headings that don't respond to taps — which
       reads as broken, not as loading.
     · You'd have to rebuild keyboard support, focus, and the
       screen-reader announcement of expanded/collapsed by hand, and
       most hand-rolled versions quietly skip all three.

   <details> is the browser's own dropdown. It opens with no JavaScript
   at all, Space and Enter work, and a screen reader says "expanded" or
   "collapsed" without being told to. Zero state, zero bugs of the kind
   above.

   ⭐ Same rule as avatar_kind further down this file: one fact, one
   home. Here the fact is "is this open", and the browser already owns
   it — so we don't keep a second copy.
   ===================================================================== */
function Section({ title, open = false, children }) {
  return (
    <details className="msec" open={open}>
      <summary className="msum">
        <span>{title}</span>
        {/* aria-hidden: <details> already announces its own state, so
            letting a screen reader read this arrow would say the state
            twice, in two different vocabularies. */}
        <span className="mchev" aria-hidden="true">›</span>
      </summary>
      <div className="mbody">{children}</div>
    </details>
  );
}

export default function Me({ email, profile, posts, initialAvatarUrl,
                             postPhotoUrls = {}, notes = [], pendingTags = [] }) {
  /* Tags waiting on this member (0082). Kept in state so approving or
     declining one takes it off the screen immediately — the person is
     standing right there watching, and a round trip reads as a dead
     button. Same call the drops and edit paths already learned. */
  const [pend, setPend] = useState(pendingTags);
  const [pendBusy, setPendBusy] = useState('');
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
  const [findable, setFindable] = useState(!!profile.findable_by_name);

  /* ---- name and face (0012) ---- */
  const [dname, setDname] = useState(profile.display_name || '');
  const [avatar, setAvatar] = useState(profile.avatar || '');

  /* ---- a real photo (0022) ----
     Three pieces of state for one picture, and each earns its place:

       photoPath  what is stored — a path like 'avatars/9f3c.webp'
       photoUrl   a signed link, because the bucket is private and the
                  path alone will not load
       photoKind  whether the photo or the emoji is the one being used

     ⚠️ photoPath and photoUrl are kept apart rather than merged because
     they expire differently. The path is permanent; the link dies in an
     hour. Collapse them into one field and you get an app that shows
     everybody's face perfectly until somebody leaves a tab open through
     lunch, which is the kind of bug that takes a day to reproduce. */
  const [photoPath, setPhotoPath] = useState(profile.avatar_photo || '');
  const [photoUrl,  setPhotoUrl]  = useState(initialAvatarUrl || '');
  const [photoKind, setPhotoKind] = useState(profile.avatar_kind || 'emoji');

  /* ---- READ FIRST, EDIT ON PURPOSE (Ty's call, Aug 16) ----

     This page used to be ten open forms stacked on top of each other:
     name, face, privacy, date, lifetime, bio, location, sponsoring, song,
     autoplay, account. Every one of them expanded, all shouting at once.
     Ty: "it's really messy. there's too many drop down windows. it doesn't
     make any sense."

     He was right, and the reason is that /me was doing two unrelated jobs
     under identical headings — THIS IS YOUR PAGE (what people see) and
     THESE ARE YOUR SETTINGS (knobs nobody else will ever look at). Stacked
     together there was no way to tell which was which.

     So: the page you land on is now a page you READ. One pencil opens the
     settings. Nothing was deleted — every field, every save path and every
     piece of state below is untouched, just moved behind `editing`. That
     was deliberate: a restructure that also rewrites the save logic is two
     changes wearing one commit, and when it breaks you can't tell which
     half did it. */
  const [editing, setEditing] = useState(false);

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

  /* ---- ⚠️ THIS PAGE NO LONGER MARKS ANYTHING READ ----

     It used to, back when a single dot sat on the "You" tab. Ty moved the
     dots onto Home, Chat and Meetings — where the thing actually is — and
     that changes who is allowed to put them out.

     If opening your settings cleared the Home dot, you could lose the
     only signal that somebody answered you, without ever seeing the
     reply. The tab that holds the thing is the tab that clears it: /wall
     clears 'reply', the chat inbox clears 'message'.

     So this list is now a record rather than an inbox. Anything still
     unread keeps its edge until you go and read it. */

  function pickFace(e) {
    setAvatar(avatar === e ? '' : e);
    setFaceOpen(false);
    setRefocus((n) => n + 1);
  }

  /* ⚠️ Removing a photo does NOT wait for Save, unlike every other field
     on this page. That inconsistency is deliberate.

     Everything else here is staged so you can change your mind — type a
     bio, dislike it, navigate away, nothing happened. But "take my face
     off the internet" is not a preference, it's usually a person who has
     just realised something and wants it gone NOW. Making them find the
     Save button first, while the photo is still up, is the app arguing
     with somebody having a bad minute.

     So it deletes the file and clears the column in one go, server-side.
     There is no undo, which is the correct amount of undo for this. */
  async function removePhoto() {
    setErr(''); setNote(''); setBusy(true);
    try {
      const res = await fetch('/api/photo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'avatar' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "That photo couldn't be removed.");
      }
      setPhotoPath(''); setPhotoUrl(''); setPhotoKind(avatar ? 'emoji' : 'none');
      setNote('Photo removed.');
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const anon = privacy === 'anonymous';

  /* =================================================================
     WHAT GOES IN THE CIRCLE — decided ONCE.

     ⚠️ THE BUG THIS REPLACES WAS WORSE THAN IT LOOKED. This page drew a
     face in three places and each one answered the question differently:

       the big circle   →  {avatar || 'TY'}     ← literally the string "TY"
       the edit card    →  {avatar || '🌱'}
       the picker       →  the photo

     So the photo showed in one place out of three, which is why it read
     as "the feature is broken" rather than "one branch is missing".

     And the first one is the bad one: 'TY' is a HARDCODED LITERAL. It is
     not derived from anybody. Every member with no emoji and no photo saw
     TY on their own page — Jacoby's profile said TY, Ivyblue's profile
     said TY. My initials, on other people's accounts, on the one screen
     that is supposed to be theirs.

     Three copies of a rule is three chances to get it wrong, and the copy
     that goes wrong is the one nobody re-reads. So: one function, three
     call sites, no literals.
     ================================================================= */
  const initials =
    ((dname || profile.handle || '').match(/[A-Za-z0-9]/g) || ['?'])
      .slice(0, 2).join('').toUpperCase();

  /* photo → chosen emoji → initials. Anonymous short-circuits the lot,
     because on an anonymous profile a face is the thing we are hiding. */
  function Face({ cls }) {
    if (!anon && photoKind === 'photo' && photoUrl) {
      return <img className={`${cls} ${cls}-photo`} src={photoUrl}
                  alt="" aria-hidden="true" />;
    }
    return (
      <div className={cls} aria-hidden="true">
        {anon ? '🤫' : (avatar || initials)}
      </div>
    );
  }
  const deetsDirty =
    bio !== (profile.bio || '') || town !== (profile.town || '') ||
    state !== (profile.state || '') || programs !== (profile.programs || '') ||
    interests !== (profile.interests || '');

  const d = dayCount(since);
  /* Only ever a number on YOUR page. startsInDays() is never handed to a
     view, a query or another member — see lib/milestones.js. */
  const soon = startsInDays(since);
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
    /* HARD navigation, not router.push, and there are two separate reasons.

       1. Security. router.push is a soft navigation — React stays mounted
          and Next's client router cache keeps the already-fetched RSC
          payloads for /wall and /me. Those were rendered for the account
          that just signed out. Hitting Back could paint the previous
          member's page from cache on a shared or borrowed phone, which is
          the worst place for this app to leak. A full load throws all of
          it away.

       2. The door has to change colour. Sign-out is a green room → grunge
          door crossing. On a soft navigation the browser keeps the green
          stylesheet in the document, so /login would render green and the
          whole grunge-door idea would silently break — no error, nothing
          in the console, just a wrong-looking page. */
    window.location.assign('/login');
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

        {/* ---- the count ----

            🔴 A DATE THAT HASN'T ARRIVED GETS A SENTENCE, NOT A NUMBER.

            Somebody can set a sober date in the future — a day they mean
            to start. The app used to answer that with "-130", and before
            today's fix the honest-looking alternative was "day 0", which
            is a lie: day 0 means you started today.

            ⚠️ This line exists ONLY here, on your own page, where you set
            the date. It is not in public_profiles and it never should be
            (0064): a public countdown announces that a member is using
            right now, which is the newcomer-flag problem with a clock on
            it. Everyone else sees nothing at all — the same as a member
            who chose not to share a date.

            ⚠️ And no encouragement attached. "You've got this!" on a date
            somebody may have picked in a bad hour is the app having an
            opinion about a decision it knows nothing about.

            ⚠️ The style is inline rather than a class because wall.css is
            71KB and failed to upload on three consecutive deploys last
            night — adding one rule to it means re-running that gauntlet
            for a single line.

            ⚠️ AND THIS COMMENT LIVES UP HERE ON PURPOSE. It was first
            written inside the ternary, directly above the p tag, and the
            build failed with "Expected ',', got 'style'". A braced JSX
            comment cannot LEAD a ternary branch: the parser meets the
            opening brace where it expects an expression and starts
            reading an object literal, so the very next tag looks like a
            malformed key. Second time in two days — the same thing
            happened inside an && last night.

            ⚠️ Then the rewrite broke too, because it quoted a comment
            marker as an example and the closing star-slash ended THIS
            comment four lines early. A JSX comment cannot contain the
            characters that end one. Do not write them here. */}
        {soon !== null ? (
          <p style={{ margin: '1.2rem 0 1.6rem', fontSize: '15px', lineHeight: 1.6, opacity: 0.85 }}>
            Your date is set for {new Date(since + 'T00:00:00').toLocaleDateString(
              undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
            {' '}The count starts then.
          </p>
        ) : (
          <Milestones since={since || null} days={d}
                      sub={(d === 1 ? 'day' : 'days') + ' · @' + profile.handle} />
        )}

        {/* =================================================================
            THE READ VIEW — your page as a page, not a form.

            Only rendered when you are NOT editing, so the two states can
            never both be on screen arguing about which value is current.
            ================================================================= */}
        {!editing && (
          <>
            {/* ---- WHO GOT BACK TO YOU ----

                ⚠️ Nothing renders when there's nothing. No "You're all
                caught up!", no empty-state illustration, no zero. An app
                that reports the absence of news is still talking to you
                about news — and a person who opens this in a bad hour and
                reads "no one has replied to you" has been told something
                cruel by a computer that meant nothing by it.

                Silence is allowed to just be silence. */}
            {/* ---- tags waiting on you (0082) ----

                ⚠️ ABOVE "who got back to you", deliberately. This is the
                only thing on the page that needs a DECISION; everything
                else is news. A choice buried under a list is a choice
                nobody makes.

                ⚠️ Nothing renders when there is nothing pending — same
                rule as the notifications below. No "you're all caught up",
                no empty state. Silence is allowed to be silence. */}
            {pend.length > 0 && (
              <div className="pendtags">
                <h2 className="sec">Somebody tagged you</h2>
                <ul>
                  {pend.map((t) => (
                    <li key={t.post_id}>
                      <p className="pt-who">
                        <b>{t.tagged_by}</b> put your handle on a post
                      </p>
                      {t.preview ? <p className="pt-prev">“{t.preview}”</p> : null}
                      {/* 🔴 The sentence that makes the whole feature make
                          sense. Without it a person cannot tell whether
                          their name is already out there. */}
                      <p className="pt-note">
                        Your handle isn’t on it yet. Nobody sees this until you say so.
                      </p>
                      <div className="pt-btns">
                        <button className="pt-yes" type="button" disabled={!!pendBusy}
                                onClick={async () => {
                                  setPendBusy(t.post_id);
                                  const { error } = await supabase.rpc('approve_my_tag', { p_post: t.post_id });
                                  setPendBusy('');
                                  /* ⚠️ Only drop it from the list if the
                                     database agreed. Removing it optimistically
                                     on failure would tell somebody their name
                                     is showing when it isn't. */
                                  if (!error) setPend((l) => l.filter((x) => x.post_id !== t.post_id));
                                }}>
                          Let it show
                        </button>
                        {/* ⚠️ remove_my_tag is the SAME call used to take your
                            name off an approved post. Declining and removing
                            are one act — a separate decline_tag() would be a
                            second implementation of one rule. */}
                        <button className="pt-no" type="button" disabled={!!pendBusy}
                                onClick={async () => {
                                  setPendBusy(t.post_id);
                                  const { error } = await supabase.rpc('remove_my_tag', { p_post: t.post_id });
                                  setPendBusy('');
                                  if (!error) setPend((l) => l.filter((x) => x.post_id !== t.post_id));
                                }}>
                          No thanks
                        </button>
                      </div>
                      {/* 🔴 They are never told. Same as an ignored friend
                          request: the person declining may be avoiding a
                          dealer, an ex, or someone from the years they are
                          leaving behind. If saying no starts a conversation,
                          people stop saying no. */}
                      <p className="pt-fine">“No thanks” doesn’t tell them.</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notes.length > 0 && (
              <div className="nots">
                <h2 className="sec">Who got back to you</h2>
                <ul>
                  {notes.map((n) => (
                    <li key={n.id} className={n.unread ? 'fresh' : ''}>
                      <Link href={n.kind === 'message' ? '/chat' : '/wall'}
                            className="notl">
                        <span className="notw">
                          {/* who_handle is null when they were anonymous,
                              so there is nothing to link and no way to
                              work out who it was. */}
                          {n.who}
                          {n.kind === 'message' ? ' messaged you'
                                                : ' replied to your post'}
                        </span>
                        {n.about ? <span className="nota">“{n.about}”</span> : null}
                        <span className="notm">{ago(n.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="phead">
              {/* The big circle at the top of your own page — the first
                  thing you look at, and the one that was drawing "TY". */}
              <Face cls="pface" />
              <h2 className="pn">
                {anon ? profile.handle : (dname || profile.handle)}
                {!anon && showLoc && town ? <span className="pdot"> · {town}{state ? ', ' + state : ''}</span> : null}
              </h2>
              {/* ⚠️ NO PROSE ON AN ANONYMOUS PAGE. Free text is the easiest
                  way to unmask yourself by accident — a bio naming your town,
                  your job and your dog is an identification. Same rule the
                  public profile already follows. */}
              {!anon && bio ? <p className="pbio">{bio}</p> : null}
            </div>

            {/* ---- personal details, with the one pencil ---- */}
            <div className="deets">
              <div className="deets-hd">
                <h3>Personal details</h3>
                <button type="button" className="pencil" onClick={() => setEditing(true)}
                        aria-label="Edit your details">✏️</button>
              </div>

              {/* ⚠️ The sponsor row is gated to 365 days. That gate was a
                  safety call, not a product one: "available to sponsor" on a
                  page belonging to somebody three weeks in is exactly the
                  shape of a 13th-stepping problem. Do not lower it. */}
              {/* ⚠️ .deet, NOT .mrow. `.mrow` looks similar and is a BUTTON
                  style — it turns acid on hover and takes a focus ring. Read-only
                  facts wearing it would look tappable and do nothing, which is
                  how you teach somebody the app is broken. `.deet` is the same
                  card the public profile at /u already uses, so the two views
                  of the same information can't drift apart. */}
              {!anon && sponsor === 'available' && d !== null && d >= 365 && (
                <div className="deet sponsor">
                  <span className="di" aria-hidden="true">🛟</span>
                  <span>Available to sponsor</span>
                </div>
              )}

              {/* ⚠️ THE BUG THIS FIXES, Aug 18: your own page showed only
                  programs and interests. Everything else you'd filled in —
                  your sponsor status, your town — was saved and invisible
                  to you, while a stranger's page showed theirs.

                  That's worse than a missing feature. You tick "looking
                  for a sponsor", come back to your page, see nothing, and
                  reasonably conclude it didn't save. The only page where
                  you can check your own settings has to show all of them.

                  ⚠️ ONE EXCEPTION, DELIBERATE: this is your OWN page, so
                  `looking` is shown to you regardless of your day count.
                  The 0031 gate is about who may see it on SOMEBODY ELSE'S
                  page. Hiding your own setting from yourself would mean a
                  member under a year could never confirm what they'd
                  chosen — a privacy rule turned into a trap. */}
              {!anon && sponsor === 'has_sponsor' && (
                <div className="deet">
                  <span className="di" aria-hidden="true">🤝</span>
                  <span>Has a sponsor</span>
                </div>
              )}
              {!anon && sponsor === 'looking' && (
                <div className="deet sponsor">
                  <span className="di" aria-hidden="true">🔎</span>
                  <span>Looking for a sponsor</span>
                  {/* Say who can see it, right where it's shown. Otherwise
                      "quiet" is indistinguishable from "broken". */}
                  <span className="deet-sub">only members with a year can see this</span>
                </div>
              )}

              {/* Your town, on your own page. It was only in the small grey
                  line next to your name — easy to miss, and absent
                  entirely if you'd typed a town but left it hidden. Now
                  it's a row like every other fact, and it says which of
                  those two states you're in. */}
              {!anon && town && (
                <div className="deet">
                  <span className="di" aria-hidden="true">📍</span>
                  <span>{town}{state ? ', ' + state : ''}</span>
                  {!showLoc && (
                    <span className="deet-sub">hidden — only you see this</span>
                  )}
                </div>
              )}
              {!anon && programs && (
                <div className="deet">
                  <span className="di" aria-hidden="true">🧭</span><span>{programs}</span>
                </div>
              )}
              {!anon && showLoc && town && (
                <div className="deet">
                  <span className="di" aria-hidden="true">📍</span>
                  <span>{town}{state ? ', ' + state : ''}</span>
                </div>
              )}
              {!anon && interests && (
                <div className="deet">
                  <span className="di" aria-hidden="true">🎣</span><span>{interests}</span>
                </div>
              )}

              {/* An empty card with a pencil is a dead end — say what the
                  pencil is for rather than showing four blank rows. */}
              {/* ⚠️ THIS CONDITION HAS TO MIRROR THE ROWS ABOVE, EXACTLY.
                  It used to read `!(showLoc && town) && sponsor !== 'available'`,
                  which was right when a town only appeared if it was public
                  and the only sponsor state was 'available'. Both changed
                  today, and a stale emptiness test is worse than none: it
                  prints "Nothing filled in yet" directly above the three
                  things you just filled in.

                  Derived from the same values the rows use, so the two
                  can't drift again. */}
              {(anon || (!programs && !interests && !town && sponsor === 'private')) && (
                <p className="hint" style={{ margin: 0 }}>
                  {anon
                    ? 'You’re anonymous, so nothing here is shown to anybody. The pencil still opens your settings.'
                    : 'Nothing filled in yet. The pencil adds your programs, where you are, what you’re into, and anything about sponsoring.'}
                </p>
              )}
            </div>

            {/* ---- the anthem ---- */}
            {song?.anthem_url ? (
              <SongPlayer song={song} whose="my anthem" big />
            ) : (
              <p className="hint">
                No song yet. The pencil adds one &mdash; the song that got you through.
              </p>
            )}

            {/* ---- the way out ----
                🔴 Aug 23. Ty: "we need a log out on the site." It was
                already built — behind the pencil, at the bottom of a long
                settings list, under "🔑 Account". THREE STEPS DEEP.

                ⭐ He owns the app and couldn't find it. A member has no
                chance. This is the same shape as the Aug 19 bug where you
                couldn't delete your own post: everything built except the
                way in. Four days of building didn't find that one either —
                one person using it did.

                ⚠️ It sits at the very BOTTOM of the read view, quiet and
                small. The original reason for hiding it was sound — sign
                out is the one control here you can't undo by tapping
                again, and it doesn't belong next to your own face. That
                reasoning argued for putting it LAST. It did not argue for
                putting it behind a pencil.

                ⚠️ Calls the SAME signOut() as the settings one, so there is
                no second implementation to drift. Two buttons, one door. */}
            {/* 🔴 AND I PUT THIS ONE BEHIND THE PENCIL TOO — an hour after
                writing the note above about why that was wrong.

                The switch shipped inside a <Section>, which only renders
                in the settings panel. Three steps deep, identical to
                sign-out on Aug 23, ninth instance this month. Caught by
                loading the live page and finding .pushbox simply absent —
                the build was green the whole time.

                ⚠️ ONE COPY, on the read view. The settings version was
                DELETED rather than left alongside: two mounts of a control
                that asks the browser for permission would let somebody
                grant it in one place and see the other still saying "off".

                It sits above sign-out for the same reason sign-out sits
                last — this is a thing you decide about your phone, not
                about your account. */}
            <PushSwitch />

            <div className="meout">
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
        )}

        {/* =================================================================
            EVERYTHING BELOW IS THE SETTINGS SIDE. Behind the pencil.
            ================================================================= */}
        {editing && (
        <>
        <div className="editbar">
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
            ‹ Done
          </button>
        </div>

        {/* ---- name and face ---- */}
        <Section title="🙂 Your name and face" open>

          <div className="pcard">
            {/* "This is exactly how your card looks to everybody else" — a
                claim that was false while this drew a seedling and the Wall
                drew the photo. */}
            <Face cls="pav" />
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

          {/* ---- A REAL PHOTO (Ty's call, Aug 17) ----

              ⚠️ The anonymous branch is not a disabled control. When your
              profile is anonymous there is no upload button here at all,
              because a greyed-out button invites you to work out how to
              un-grey it, and the answer would be "give up your anonymity"
              — which is a trade nobody should be nudged into by UI.

              The line about nothing being deleted matters too. A member who
              switches to anonymous and sees their photo vanish will assume
              it's gone. It isn't: avatar_photo is untouched, and
              public_profiles simply stops serving it. Say so, or they'll
              re-upload it and wonder why it happened again. */}
          <label id="photolab">Your photo</label>
          {anon ? (
            <p className="hint phoff">
              Photos are off while your profile is anonymous &mdash; a face is the
              fastest way to stop being anonymous by accident. Nothing has been
              deleted. Switch to open above and it comes back.
            </p>
          ) : (
            <div className="phrow">
              <div className={'phnow' + (photoKind === 'photo' && photoUrl ? ' has' : '')}>
                {photoKind === 'photo' && photoUrl
                  ? <img src={photoUrl} alt="Your profile photo" />
                  : <span aria-hidden="true">{avatar || '🌱'}</span>}
              </div>
              <div className="phacts">
                <PhotoUpload
                  kind="avatar"
                  disabled={busy}
                  label={photoPath ? 'Choose a different one' : 'Use a photo'}
                  onDone={(path, preview) => {
                    setPhotoPath(path); setPhotoUrl(preview); setPhotoKind('photo');
                  }} />
                {photoPath && photoKind === 'photo' && (
                  <button type="button" className="btn ghost" disabled={busy}
                          onClick={() => setPhotoKind(avatar ? 'emoji' : 'none')}>
                    Show the emoji instead
                  </button>
                )}
                {photoPath && photoKind !== 'photo' && (
                  <button type="button" className="btn ghost" disabled={busy}
                          onClick={() => setPhotoKind('photo')}>
                    Show the photo
                  </button>
                )}
                {photoPath && (
                  <button type="button" className="btn ghost phdel" disabled={busy}
                          onClick={removePhoto}>
                    Remove it
                  </button>
                )}
                <p className="hint phnote">
                  The location tag phones hide inside photos is stripped off before
                  it saves &mdash; a picture of your kitchen can&apos;t give away your address.
                </p>
              </div>
            </div>
          )}

          <label id="facelab">Pick a face</label>
          {/* Why a fixed list and not a text box: see FACE_GROUPS up top.
              The emoji is still here and still the default — a photo is an
              option, not an expectation. Plenty of people in recovery have
              excellent reasons not to have a face on anything. */}
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

          {/* ⚠️ avatar_kind is DERIVED here, never stored as a fourth piece
              of state that has to be kept in step with the other three.
              Same rule as the sign-up/sign-in door in the Aug 15 session:
              one fact, one home. A separate kind field would eventually
              disagree with whether a photo actually exists, and the failure
              mode is somebody's page rendering a blank circle where their
              face should be. */}
          <button className="btn" type="button"
                  disabled={busy || (dname === (profile.display_name || '')
                                     && avatar === (profile.avatar || '')
                                     && photoPath === (profile.avatar_photo || '')
                                     && photoKind === (profile.avatar_kind || 'emoji'))}
                  onClick={() => save({
                    display_name: dname.trim() || null,
                    avatar: avatar || null,
                    avatar_photo: photoPath || null,
                    avatar_kind: (photoKind === 'photo' && photoPath) ? 'photo'
                               : avatar ? 'emoji' : 'none',
                  }, 'Saved. That’s you now.')}>
            {busy ? 'Saving…' : 'Save name and face'}
          </button>

          {/* The old copy here said "photos are coming". They came, so it
              goes. ⚠️ A stale promise left in the UI is worse than no copy
              at all — it teaches people the app is describing a different
              version of itself than the one they're holding. */}
          <p className="hint">
            A photo is your choice and you can take it off whenever you like. Worth
            knowing before you put one up: anyone who can see it can screenshot it,
            here or anywhere else. The emoji is a perfectly good answer.
          </p>

          {/* ---- privacy ---- */}
        </Section>
        <Section title="👀 How you show up">
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
        </Section>
        <Section title="🌱 Your date">
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
        </Section>
        <Section title="📝 About you">

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

          {/* ⚠️ OFF BY DEFAULT, AND THAT DEFAULT IS THE FEATURE.
              A handle is a name you invented for this place. Your real
              name is not. With this on, anybody can type your name and
              learn you are in recovery — an employer checking a
              candidate, a relative looking for someone who left. Being
              visible on your own page and being findable by name are
              different things, and only you should decide the second.
              Same pattern as your town, which is also off until you
              choose otherwise. */}
          <button type="button"
                  className={'choice' + (findable ? ' sel' : '')}
                  aria-pressed={findable} disabled={busy}
                  onClick={() => { const n = !findable; setFindable(n);
                    save({ findable_by_name: n }, n
                      ? 'On. People can find you by your name.'
                      : 'Off. Only your handle finds you.'); }}>
            <span className="ct">
              {findable ? '🔎 Findable by your name' : '🔒 Only your handle finds you'}
            </span>
            <span className="cd">
              {findable
                ? 'Someone who knows your name can search it and land on your page.'
                : 'People can still find you by handle — just not by the name you were given.'}
            </span>
          </button>

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
        </Section>
        <Section title="📍 Where you are">
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
        </Section>
        <Section title="🤝 Sponsoring">
          {/* ⚠️ FOUR CHOICES, NOT FOUR TOGGLES. Sponsor status is ONE
              fact about you, so it's one exclusive pick — the same
              reason `one_medium_per_post` exists on the wall. Separate
              on/off switches would let somebody claim they're looking
              for a sponsor AND available to be one, which is a state
              the world doesn't have. */}
          {[
            { v: 'private',     t: '🤫 Keep this to yourself',
              d: 'Nothing about sponsoring shows on your page.' },
            { v: 'has_sponsor', t: '🤝 I have a sponsor',
              d: 'Shows on your page. Plain fact, nothing asked of anyone.' },
            { v: 'looking',     t: '🔎 I’m looking for a sponsor',
              d: 'Only people with a year or more can see this.' },
            { v: 'available',   t: '🛟 I’m available to sponsor',
              d: 'Tells people you have room for somebody.' },
          ].map((o) => (
            <button key={o.v} type="button"
                    className={'choice' + (sponsor === o.v ? ' sel' : '')}
                    aria-pressed={sponsor === o.v} disabled={busy}
                    onClick={() => { setSponsor(o.v);
                      save({ sponsor_status: o.v }, 'Saved.'); }}>
              {/* Plain interpolation. These are JS strings, so a real
                  apostrophe is fine — the unescaped-entities lint rule
                  only applies to literal text typed into JSX. */}
              <span className="ct">{o.t}</span>
              <span className="cd">{o.d}</span>
            </button>
          ))}

          {/* ⚠️ SAY THE GATE OUT LOUD. The rule is enforced in the
              database and cannot be got round — but a rule you can't
              see just looks like the feature is broken. Somebody who
              ticks "looking" and hears from nobody deserves to know
              it's deliberate, not a bug. */}
          {sponsor === 'looking' && (
            <p className="hint">
              This one is deliberately quiet. Only members with a year or more
              can see it &mdash; so it reaches people who&apos;ve been where you
              are, and not a public list of who&apos;s new and on their own.
              Nobody under a year can tell you ticked it.
            </p>
          )}

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
        </Section>
        <Section title="🎵 Your song">
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
        </Section>
        <Section title="🚪 When you visit someone">
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
            what happens when other people visit <em>you</em>. It&rsquo;s on to start
            with: open somebody&rsquo;s page and their song begins. You can turn it off
            here, or from the switch under any song, and it stays off for good.
          </p>

          {/* ---- the door ----
              Sign-out lives in settings now rather than on the page you land
              on. It is the one control here you can't undo by tapping again,
              and it does not belong next to your own face. */}
        </Section>
        <Section title="🔑 Account">
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

          {/* ⚠️ Below sign-out, not above it, and not behind another menu.
              Apple asks for account deletion to be easy to find, and hiding
              it would be wrong anyway — an exit you have to hunt for reads
              as an app that doesn't want to let you go. But it goes SECOND,
              because the control people want ninety-nine times in a hundred
              should be the one their thumb reaches first. */}
          <div className="delsep" />
          <DeleteAccount handle={profile.handle} />
        </Section>
        <div className="editbar">
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
        </>
        )}

        {/* ---- your posts ---- */}
        <h2 className="sec">What you&apos;ve put up</h2>
        {posts.length === 0 ? (
          <p className="hint">Nothing yet. The wall is through the arrow up top.</p>
        ) : (
          <ul className="mine">
            {posts.map((p) => (
              <li key={p.id} className={p.is_anonymous ? 'screened' : ''}>
                {p.body ? <p className="mb">{p.body}</p> : null}
                {/* Your page should show what you actually put up — the
                    picture as much as the words. This list showed only text,
                    so a photo post appeared here as a blank entry. */}
                {/* ⚠️ 0065: several photos become a grid, one stays exactly
                    as it was. Same rule as the wall — see app/photos.css. */}
                {(() => {
                  const shots = (Array.isArray(p.photo_urls) && p.photo_urls.length
                    ? p.photo_urls : []).filter((s) => postPhotoUrls[s]);
                  if (shots.length < 2) return null;
                  return (
                    <div className="pgrid" data-n={Math.min(shots.length, 4)}>
                      {shots.map((s, i) => (
                        <img key={s} src={postPhotoUrls[s]} loading="lazy"
                             alt={`Photo ${i + 1} of ${shots.length}`} />
                      ))}
                    </div>
                  );
                })()}
                {(!Array.isArray(p.photo_urls) || p.photo_urls.length < 2)
                  && p.photo_url && postPhotoUrls[p.photo_url] && (
                  <div className="mphoto">
                    <img src={postPhotoUrls[p.photo_url]} alt="" loading="lazy" />
                  </div>
                )}
                {p.video_url && postPhotoUrls[p.video_url] && (
                  <div className="mphoto">
                    <video src={postPhotoUrls[p.video_url]} controls playsInline
                           preload="none" />
                  </div>
                )}
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

      </div>
    </>
  );
}
