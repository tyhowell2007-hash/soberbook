'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';

/* =====================================================================
   ROOMS OPEN HERE — meetings members are holding inside Sober Book.

   Sits ABOVE the NA list, and that ordering is the argument: ours are one
   tap and can't turn anyone away; theirs cover the hours nobody here is
   awake for. Neither replaces the other.

   ---------------------------------------------------------------------
   🔴 A COUNT, NEVER A LIST OF NAMES.

   "3 in there now", never "Nic, Ivy and Jordan are in there." Publishing
   who is in a meeting at 11pm publishes exactly who is struggling and
   exactly when — the green-dot decision from Aug 16 in a new hat. The
   host's name shows because chairing is a public act they chose; being
   in the room is not.

   You find out who's there by walking in, which is how a room works.
   ===================================================================== */

export default function Rooms() {
  const supabase = browserClient();
  const [rooms, setRooms] = useState([]);
  const [canHost, setCanHost] = useState(false);
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      const [{ data: rows }, { data: ok }] = await Promise.all([
        supabase.from('open_meeting_rooms')
          .select('room_key, title, host_name, is_mine, people')
          .order('created_at', { ascending: false }),
        supabase.rpc('can_host_meetings'),
      ]);
      if (!alive) return;
      setRooms(rows || []);
      setCanHost(ok === true);
      setReady(true);
    }
    load();
    /* Every 25s. ⚠️ Polling, not a realtime subscription — a subscription
       streams the row, and rows here carry host ids. Same call as the
       owner dashboard: ask for the number, not the record. */
    const id = setInterval(load, 25000);
    return () => { alive = false; clearInterval(id); };
  }, [supabase]);

  async function open() {
    const t = title.trim();
    if (t.length < 3) { setErr('Give it a name so people know what it is.'); return; }
    setOpening(true); setErr('');
    try {
      const { data: key, error } = await supabase.rpc('open_meeting_room', { room_title: t });
      if (error) throw error;
      window.location.assign(`/room/${key}`);
    } catch (e) {
      /* The database says "You can host a meeting once you have 90 days."
         Pass it through — it's the true reason and it's kindly worded. */
      setErr(e.message || "Couldn't open that.");
      setOpening(false);
    }
  }

  if (!ready) return null;   // no flicker of "nothing open" before we know

  return (
    <section className="rmwrap">
      <h2 className="rmsec">Rooms open here</h2>

      {rooms.length === 0 && (
        <div className="rmempty">
          <p>Nobody has one open right now.</p>
        </div>
      )}

      <ul className="rmlist">
        {rooms.map((r, i) => (
          <li key={r.room_key} className={'rmitem' + (i === 0 ? ' first' : '')}>
            <div className="rmmeta">
              <span className="rmtitle">{r.title}</span>
              <span className="rmwho">
                {r.is_mine ? 'yours' : `${r.host_name} is chairing`}
                {' · '}
                {/* ⚠️ "nobody in yet" rather than "0 people" — a zero on a
                    room somebody just opened reads as a verdict. */}
                {r.people === 0 ? 'nobody in yet'
                  : r.people === 1 ? '1 in there now'
                  : `${r.people} in there now`}
              </span>
            </div>
            <a className="rmgo" href={`/room/${r.room_key}`}>Go in</a>
          </li>
        ))}
      </ul>

      {canHost ? (
        <div className="rmstart">
          <input value={title} maxLength={60}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Name it — “Can’t sleep club”"
                 aria-label="What to call your room" />
          <button type="button" className="btn" disabled={opening} onClick={open}>
            {opening ? 'Opening…' : 'Start a room'}
          </button>
        </div>
      ) : (
        /* ⚠️ Says the rule plainly instead of hiding the button. A control
           that silently isn't there teaches nothing; a sentence tells you
           it's coming and when. */
        <p className="hint rmlocked">
          You can start your own room once you have 90 days.
        </p>
      )}

      {err && <p className="phserr" role="alert">{err}</p>}
    </section>
  );
}
