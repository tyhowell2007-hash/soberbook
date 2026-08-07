'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';
import SongPicker from './SongPicker';
import SongPlayer from '../components/SongPlayer';

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
  });
  const [note, setNote] = useState('');       // the one status line, shared
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const d = days(since);
  const today = new Date().toISOString().slice(0, 10);

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
                disabled={busy || song.anthem_url === (profile.anthem_url || null)}
                onClick={() => save(song, song.anthem_url
                  ? 'Song saved. It\u2019s on your page now.' : 'Song removed.')}>
          {busy ? 'Saving…' : 'Save song'}
        </button>

        {song.anthem_url && (
          <button className="nvm" type="button" disabled={busy}
                  onClick={() => setSong({ anthem_url: null, anthem_title: null,
                                           anthem_art: null, anthem_preview: null })}>
            take my song off my page
          </button>
        )}

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
