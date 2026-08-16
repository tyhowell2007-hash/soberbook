'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

/* First run. Three things, then they're in.

   NOTE: privacy defaults to 'anonymous'. Someone who taps straight through
   without reading ends up protected rather than exposed. That's the same
   decision the schema makes with its column default, and it should stay
   consistent in both places. */
export default function Welcome() {
  const router = useRouter();
  const supabase = browserClient();
  const [handle, setHandle] = useState('');
  const [since, setSince] = useState('');
  const [privacy, setPrivacy] = useState('anonymous');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      /* Hard navigation for the same two reasons as sign-out in Me.jsx:
         it clears the router cache, and it drops the green stylesheet so
         the door renders grunge. Soft-pushing here would leave /login
         wearing the green room's clothes. */
      if (!user) { window.location.assign('/login'); return; }

      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        handle: handle.trim(),
        privacy_mode: privacy,
        sober_since: since || null,
      });
      if (error) throw error;
      router.push('/wall');
      router.refresh();
    } catch (e2) {
      const m = String(e2.message || '');
      if (m.includes('profiles_handle_lower_idx')) setErr('That handle is taken. Try another.');
      else if (m.includes('reserved')) setErr('That handle is reserved. Pick a different one.');
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
        <h1>How do you want to show up?</h1>
        <p className="sub">Your choice, and you can change it any time.</p>

        <form onSubmit={save}>
          <button type="button"
                  className={'choice' + (privacy === 'open' ? ' sel' : '')}
                  aria-pressed={privacy === 'open'}
                  onClick={() => setPrivacy('open')}>
            <span className="ct">🌱 Open</span>
            <span className="cd">Your name and picture show. Good if you're comfortable being seen.</span>
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
          <input id="h" type="text" value={handle} required minLength={3} maxLength={20}
                 pattern="[A-Za-z0-9_]{3,20}" autoComplete="off"
                 onChange={(e) => setHandle(e.target.value)} placeholder="RiverRoad88" />
          <p className="hint">Letters, numbers and underscores. This is what people see.</p>

          <label htmlFor="d">Sober date — optional</label>
          <input id="d" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          <p className="hint">
            We'll count your days and mark the milestones. Leave it blank if you'd rather not —
            you can add it later, and nothing else depends on it.
          </p>

          {/* The one thing about this place that isn't like the others,
              said plainly, at the moment someone is deciding whether to
              bother. It was true in the code from day one and had never
              once been said out loud to a member. */}
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

          <button className="btn" type="submit" disabled={busy || handle.length < 3}>
            {busy ? 'Setting up…' : 'Come in'}
          </button>
        </form>

        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
