'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

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
  const [song, setSong] = useState(profile.anthem_url || '');
  const [songTitle, setSongTitle] = useState(profile.anthem_title || '');
  const [note, setNote] = useState('');       // the one status line, shared
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const d = days(since);
  const today = new Date().toISOString().slice(0, 10);

  /* One save function for both settings instead of two nearly-identical
     ones. `patch` is just an object of columns → new values, which is what
     Supabase wants anyway.

     Note there is no .eq('id', ...) here. There doesn't need to be: the RLS
     policy on profiles already restricts every UPDATE to your own row. If I
     added the filter it would be a comment, not a control — and the day I
     mistyped it, the database would still be the thing saving me. */
  async function save(patch, said) {
    setErr(''); setNote(''); setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update(patch);
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
        <div className="count">
          {d === null ? (
            <>
              <div className="cn">—</div>
              <div className="cl">no date set yet</div>
            </>
          ) : (
            <>
              <div className="cn">{d.toLocaleString()}</div>
              <div className="cl">{d === 1 ? 'day' : 'days'} · @{profile.handle}</div>
            </>
          )}
        </div>

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
               onChange={(e) => setSince(e.target.value)} />
        <p className="hint">
          Only used to count days. Leave it empty if you&apos;d rather not have a number.
        </p>
        <button className="btn" type="button" disabled={busy || since === (profile.sober_since || '')}
                onClick={() => save({ sober_since: since || null },
                                     since ? 'Date saved.' : 'Date cleared.')}>
          {busy ? 'Saving…' : 'Save date'}
        </button>

        {/* ---- your song ---- */}
        <h2 className="sec">Your song</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          The one that got you through. It goes on the shared playlist with
          everyone else&apos;s — <Link href="/songs">have a look</Link>.
        </p>

        <label htmlFor="su">Link from Spotify, YouTube or Apple Music</label>
        <input id="su" type="text" value={song} disabled={busy} inputMode="url"
               autoComplete="off" spellCheck={false}
               onChange={(e) => setSong(e.target.value.trim())}
               placeholder="https://open.spotify.com/track/…" />
        <p className="hint">
          Paste the share link. We never upload or store the audio itself —
          it plays from the service, under their licence.
        </p>

        <label htmlFor="st">What is it?</label>
        <input id="st" type="text" value={songTitle} maxLength={120} disabled={busy}
               onChange={(e) => setSongTitle(e.target.value)}
               placeholder="Alive — P.O.D." />

        <button className="btn" type="button"
                disabled={busy || (song === (profile.anthem_url || '')
                                && songTitle === (profile.anthem_title || ''))}
                onClick={() => save(
                  { anthem_url: song || null, anthem_title: songTitle.trim() || null },
                  song ? 'Song saved. It’s on the playlist.' : 'Song removed.')}>
          {busy ? 'Saving…' : 'Save song'}
        </button>

        {note && <div className="ok">{note}</div>}
        {err && <div className="err">{err}</div>}

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
