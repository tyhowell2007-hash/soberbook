'use client';

import { useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
/* The same picker /me uses, with its preview and its block-ordering rows
   switched off — see the note on those props. Default export, which is
   the only kind a page may import. */
import LookPicker from '../components/LookPicker';
/* 🔴 THE REAL UPLOADER, NOT A LINK TO ONE. See the note where it renders. */
import PhotoUpload from '../components/PhotoUpload';

const LABELS = ['Spotify', 'Apple Music', 'YouTube', 'SoundCloud', 'Instagram', 'TikTok', 'Facebook', 'Website', 'Merch', 'Bandcamp'];
const blankLink = () => ({ label: 'Spotify', url: '' });
const blankShow = () => ({ date: '', venue: '', city: '', url: '' });
const blankBook = () => ({ title: '', blurb: '', url: '', tag: '' });

/* =====================================================================
   THE FORM.  19 Sept 2026.
   One component, five states, all decided by artist_mine():
     anonymous mode · never applied · waiting · not yet · approved.
   ⚠️ Links must start with https:// — the database drops anything else
   (javascript:, http:, plain text), so a link that disappears after
   saving was refused there, not lost here.
   ===================================================================== */
export default function Artist({ initial, handle, look = null, face = null,
                                emoji = '', photoPath = '' }) {
  const supabase = browserClient();
  const [m, setM] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');

  // application fields
  const [name, setName] = useState('');
  const [genre, setGenre] = useState(initial?.genre || '');
  const [links, setLinks] = useState(
    initial?.links?.length ? initial.links : [blankLink()]);
  const [claims, setClaims] = useState('');
  const [proof, setProof] = useState('');
  const [agree, setAgree] = useState(false);
  const [shows, setShows] = useState(initial?.shows?.length ? initial.shows.map((s) => ({ url: '', city: '', ...s })) : []);

  /* ---- 0184: the rest of their page, which used to be Ty's to type ----
     ⚠️ SEPARATE FROM `name` ABOVE. That one belongs to the application
     form and starts empty on purpose — somebody applying has not got a
     stored name yet. These start from what is already on the page, so
     opening the editor and pressing Save changes nothing. */
  /* The face, owned here now. `path` is what the database stores
     ('avatars/9f3c.webp'); `url` is a signed link that expires and is only
     good for drawing the picture. Same split as Me.jsx — see the long note
     there about why they are never merged. */
  const [facePath, setFacePath] = useState(photoPath || '');
  const [faceUrl, setFaceUrl] = useState(face || '');
  const [faceMsg, setFaceMsg] = useState('');

  const [aName, setAName] = useState(initial?.name || '');
  const [role, setRole] = useState(initial?.role_line || '');
  const [about, setAbout] = useState(initial?.about || '');
  const [year, setYear] = useState(initial?.since_year ? String(initial.since_year) : '');
  const [books, setBooks] = useState(
    initial?.books?.length ? initial.books.map((b) => ({ ...blankBook(), ...b })) : []);

  const status = m?.status || null;
  const retry = m?.retry_after && new Date(m.retry_after + 'T12:00:00') > new Date();

  function setLink(i, k, v) { setLinks(links.map((l, j) => (j === i ? { ...l, [k]: v } : l))); }
  function setShow(i, k, v) { setShows(shows.map((s, j) => (j === i ? { ...s, [k]: v } : s))); }
  function setBook(i, k, v) { setBooks(books.map((b, j) => (j === i ? { ...b, [k]: v } : b))); }

  /* 🔴 SAVES ON THE SPOT, WITH NO SAVE BUTTON TO MISS. 20 Sept: Produkt
     spent an evening on this, and one of the ways it failed him was a
     Save button further down a long form that he never reached. A picture
     is not a draft — the moment it is chosen, the choice is made.

     ⚠️ avatar_kind is DERIVED, never stored as a separate opinion that can
     drift from whether a photo actually exists. Same rule as Me.jsx: one
     fact, one home. Dropping the photo falls back to their emoji if they
     have one and to nothing if they don't. */
  async function saveFace(path) {
    setFaceMsg(''); setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update({
        avatar_photo: path || null,
        avatar_kind: path ? 'photo' : (emoji ? 'emoji' : 'none'),
      }).eq('id', user.id);
      if (error) throw error;
      setFaceMsg(path ? 'Saved. That\u2019s your face now.' : 'Taken off.');
    } catch (e) {
      setErr('That picture didn\u2019t save. Try again in a second.');
    }
  }
  const cleanLinks = () => links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() }));

  async function apply(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('artist_apply', {
      p_name: name, p_genre: genre, p_links: cleanLinks(),
      p_claims: claims, p_proof: proof, p_agree: agree,
    });
    if (error) setErr(error.message); else setM(data);
    setBusy(false);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setSaved('');
    /* ⚠️ ALL EIGHT ARGUMENTS, EVERY TIME. artist_update() writes the whole
       row, so a field left out of this call is a field blanked on the
       page. The three-argument version still exists in the database only
       so an older deployed build cannot break mid-deploy (0184); nothing
       here should call it. */
    const { data, error } = await supabase.rpc('artist_update', {
      p_name: aName,
      p_genre: genre,
      p_role_line: role,
      p_about: about,
      p_since_year: year.trim() ? Number(year.trim()) : null,
      p_books: books.filter((b) => b.title.trim())
                    .map((b) => ({ title: b.title.trim(), blurb: b.blurb.trim(),
                                   url: b.url.trim(), tag: b.tag.trim().slice(0, 3).toUpperCase() })),
      p_links: cleanLinks(),
      p_shows: shows.filter((s) => s.date && s.venue.trim()),
    });
    if (error) setErr(error.message);
    else {
      setM(data);
      setLinks(data.links?.length ? data.links : [blankLink()]);
      setShows((data.shows || []).map((s) => ({ url: '', city: '', ...s })));
      setBooks((data.books || []).map((b) => ({ ...blankBook(), ...b })));
      /* Read back what the database kept, not what was typed: it trims,
         caps lengths and drops a year it does not believe. Somebody who
         typed 3024 should see the field empty rather than be told it
         saved. */
      setAName(data.name || '');
      setRole(data.role_line || '');
      setAbout(data.about || '');
      setYear(data.since_year ? String(data.since_year) : '');
      setSaved('Saved.');
    }
    setBusy(false);
  }

  const linkRows = (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 🔴 "Links to YOUR MUSIC" was wrong the day authors and
          podcasters got this page (0180). Dr. Labor's links are a
          website, a podcast and four socials. */}
      <legend className="art-sub" style={{ marginBottom: 6 }}>Your links (https://)</legend>
      {/* 0186: the ten are SUGGESTIONS now, not the menu. The database
          has always taken any label up to 30 characters — it was this
          control that only offered a dropdown, so a creator with a
          Patreon, a vinyl preorder or a Substack had nowhere to put it
          and no way to tell that the limit wasn't real. A datalist keeps
          one tap for the common ones and a keyboard for everything
          else. */}
      <datalist id="artist-link-labels">
        {LABELS.map((x) => <option key={x} value={x} />)}
      </datalist>
      {links.map((l, i) => (
        <div className="art-pair" key={i}>
          <label htmlFor={`al-k${i}`}>Where
            <input id={`al-k${i}`} list="artist-link-labels" maxLength={30}
                   placeholder="Spotify, Patreon, anything"
                   value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} />
          </label>
          <label htmlFor={`al-u${i}`}>Link
            <input id={`al-u${i}`} type="url" inputMode="url" placeholder="https://"
                   value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} />
          </label>
          <button type="button" className="art-x" aria-label="Remove this link"
                  onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [blankLink()])}>×</button>
        </div>
      ))}
      {/* 12 and 10 to match 0186 — change these and the SQL together or
          the member gets a row that saves nothing. */}
      {links.length < 12 && (
        <button type="button" className="art-btn ghost small" onClick={() => setLinks([...links, blankLink()])}>
          + Add a link
        </button>
      )}
    </fieldset>
  );

  if (m?.anonymous) {
    return (
      <p className="art-note">
        Artist profiles are public, and your profile is in anonymous mode.
        Switch to open mode on <Link href="/me" style={{ color: 'inherit' }}>your page</Link> first,
        then come back here to apply.
      </p>
    );
  }

  if (status === 'pending') {
    return (
      <p className="art-note">
        <b>Your application is in.</b> The team checks every one by hand, usually within a week.
        This page will change when it&apos;s been looked at.
      </p>
    );
  }
  if (status === 'revoked') {
    return <p className="art-note">Your artist profile was removed. Message the team if you think that was a mistake.</p>;
  }
  if (status === 'declined' && retry) {
    return (
      <p className="art-note">
        Not yet — the team couldn&apos;t approve this one right now. You can apply again on{' '}
        {new Date(m.retry_after + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
      </p>
    );
  }

  if (status === 'approved') {
    return (
      <form className="art-form" onSubmit={save}>
        <p className="art-note">
          <b>You&apos;re a verified artist</b> — the gold checkmark shows next to your name.{' '}
          {handle && <Link href={`/u/${handle}`} style={{ color: 'inherit' }}>See your page</Link>}
          {' '}· {Number(m.followers || 0).toLocaleString()} {Number(m.followers) === 1 ? 'follower' : 'followers'}
        </p>

        {/* ---- the picture ----
            🔴 THE PHOTO IS NOT ARTIST DATA. It is the same profile photo
            every member has — /u/[handle] reads it from public_profiles,
            not from the artists row — which is why Dr. Labor's shows on
            her artist page without anything artist-specific behind it.
            So this is a door to the one control that owns it, not a
            second uploader. Two controls writing one column is how the
            two drift apart and how somebody ends up with a face on one
            screen and not the other. */}
        <div className="art-sect" style={{ marginTop: 0 }}>
          <p className="art-sub">Your picture</p>
          {/* 🔴 20 SEPT, LATE — THIS USED TO BE A LINK TO /me#face, AND THE
              LINK IS WHAT BROKE. Produkt spent an entire evening trying to
              put his face on his page. He found this button every time. It
              sent him to the top of a long settings page, where the control
              he wanted sat several screens down under a heading that says
              "Your photo" beside a button that says "Use a photo" — and he
              never got there. Four rounds of "it doesn't work".

              I argued for the link when this was built: one column, one
              control, no drift. That reasoning was fine and the outcome was
              still that a verified artist could not put up a picture. A
              handoff between two screens is a place people fall.

              ⚠️ IT IS STILL ONE CONTROL AND ONE COLUMN. This is the same
              PhotoUpload component and the same `profiles.avatar_photo`
              that /me writes; nothing was duplicated. What changed is that
              it is now reachable from the page it affects. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <div className="art-av" style={{ width: 64, height: 64, marginTop: 0, fontSize: 26, borderWidth: 2 }}>
              {faceUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={faceUrl} alt="" />
                : (emoji || String(aName || handle || '?').slice(0, 1).toUpperCase())}
            </div>
            <div>
              <PhotoUpload
                kind="avatar"
                disabled={busy}
                label={facePath ? 'Choose a different one' : 'Use a photo'}
                onDone={(path, preview) => {
                  setFacePath(path); setFaceUrl(preview); saveFace(path);
                }} />
              {facePath && (
                <button type="button" className="art-btn ghost small" style={{ marginTop: 6 }}
                        onClick={() => { setFacePath(''); setFaceUrl(''); saveFace(''); }}>
                  Take it off
                </button>
              )}
              <p className="art-none" style={{ marginTop: 6 }}>
                Shows at the top of this page and next to everything you post.
                It saves as soon as you pick one.
              </p>
              {faceMsg && <p className="art-count" role="status">{faceMsg}</p>}
            </div>
          </div>
        </div>

        <label htmlFor="an2">Artist or band name<input id="an2" maxLength={60} value={aName} onChange={(e) => setAName(e.target.value)} /></label>
        <label htmlFor="arl">The line under your name<input id="arl" maxLength={60} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Musician · Producer" /></label>
        <label htmlFor="ag">Genre<input id="ag" maxLength={40} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Alternative rap" /></label>
        <label htmlFor="aab">About<textarea id="aab" rows={4} maxLength={600} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A few lines about you." /></label>
        {/* Given a year, the bar at the top of the page says "Since 2005 in
            recovery" instead of a day count — Dr. Labor's approved
            prototype. Left empty, the day count stays. Either is fine;
            this is not a nudge to publish a date. */}
        <label htmlFor="asy">In recovery since (year — optional)
          <input id="asy" inputMode="numeric" maxLength={4} value={year}
                 onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ''))}
                 placeholder="2005" style={{ maxWidth: 140 }} /></label>

        <div className="art-sect">
          <p className="art-sub">How your page looks</p>
          {/* No preview and no block rows here — see the note on those
              props in LookPicker. The cover and the colour are the two
              that mean anything on an artist page. */}
          <div style={{ marginTop: 10 }}>
            <LookPicker profile={look || {}} showPreview={false} showBlocks={false} />
          </div>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="art-sub" style={{ marginBottom: 6 }}>Books</legend>
          {books.length === 0 && <p className="art-none">None listed.</p>}
          {books.map((b, i) => (
            <div className="art-pair3" key={i}>
              <label htmlFor={`bt${i}`}>Title<input id={`bt${i}`} maxLength={80} value={b.title} onChange={(e) => setBook(i, 'title', e.target.value)} /></label>
              <label htmlFor={`bb${i}`}>One line about it<input id={`bb${i}`} maxLength={90} value={b.blurb} onChange={(e) => setBook(i, 'blurb', e.target.value)} /></label>
              <label htmlFor={`bu${i}`}>Link (https://)<input id={`bu${i}`} value={b.url} onChange={(e) => setBook(i, 'url', e.target.value)} /></label>
              <button type="button" className="art-x" aria-label="Remove this book" onClick={() => setBooks(books.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {books.length < 10 && (
            <button type="button" className="art-btn ghost small" onClick={() => setBooks([...books, blankBook()])}>+ Add a book</button>
          )}
        </fieldset>

        {linkRows}
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="art-sub" style={{ marginBottom: 6 }}>Upcoming shows</legend>
          {shows.length === 0 && <p className="art-none">None listed.</p>}
          {shows.map((s, i) => (
            <div className="art-pair3" key={i}>
              <label htmlFor={`sd${i}`}>Date<input id={`sd${i}`} type="date" value={s.date} onChange={(e) => setShow(i, 'date', e.target.value)} /></label>
              <label htmlFor={`sv${i}`}>Venue<input id={`sv${i}`} maxLength={60} value={s.venue} onChange={(e) => setShow(i, 'venue', e.target.value)} /></label>
              <label htmlFor={`sc${i}`}>City<input id={`sc${i}`} maxLength={40} value={s.city} onChange={(e) => setShow(i, 'city', e.target.value)} /></label>
              <button type="button" className="art-x" aria-label="Remove this show" onClick={() => setShows(shows.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {shows.length < 12 && (
            <button type="button" className="art-btn ghost small" onClick={() => setShows([...shows, blankShow()])}>+ Add a show</button>
          )}
        </fieldset>
        {err && <p className="art-err" role="alert">{err}</p>}
        {saved && <p className="art-count" role="status">{saved}</p>}
        <button type="submit" className="art-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    );
  }

  // never applied, or allowed to apply again
  return (
    <form className="art-form" onSubmit={apply}>
      <p className="art-note">
        For musicians with a real following. Approved artists get a gold checkmark, an artist
        section on their page with links and shows, a spot in the &quot;Artists on Sober Book&quot;
        strip, and followers. You don&apos;t have to be in recovery.
      </p>
      <label htmlFor="an">Artist or band name<input id="an" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label htmlFor="ag">Genre<input id="ag" maxLength={40} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Alternative rap" /></label>
      {linkRows}
      <label htmlFor="ac">Your following
        <textarea id="ac" rows={2} maxLength={600} value={claims} onChange={(e) => setClaims(e.target.value)}
                  placeholder="e.g. 48,000 monthly listeners on Spotify, 20,000 on Instagram" />
      </label>
      <label htmlFor="ap">How we can tell the accounts are really yours
        <textarea id="ap" rows={2} maxLength={300} value={proof} onChange={(e) => setProof(e.target.value)}
                  placeholder='e.g. "I posted Sober Book ✓ on my Instagram story today"' />
      </label>
      <label className="art-check" htmlFor="aa">
        <input id="aa" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I won&apos;t promote alcohol, drugs, gambling or paid treatment centres on Sober Book.</span>
      </label>
      {err && <p className="art-err" role="alert">{err}</p>}
      <button type="submit" className="art-btn" disabled={busy || !agree}>{busy ? 'Sending…' : 'Send application'}</button>
    </form>
  );
}
