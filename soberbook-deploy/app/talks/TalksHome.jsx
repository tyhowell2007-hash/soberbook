'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../lib/supabase-browser';

/* What's live now + start a talk. Polls every 15s so a talk that starts
   while you're looking shows up without a refresh. */

const TOPICS = ['☕ Just hanging out', '🌱 Early days', '🙏 Gratitude', '💬 Ask me anything'];

function mins(since) {
  const m = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
}

function names(list) {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

function who(t) {
  const s = t.speakers || [];
  if (!s.length) return 'Starting up';
  return <><b>{s[0]}</b>{s.length > 1 ? (s.length === 2 ? ' and ' : ', ') + names(s.slice(1)) : ''} talking</>;
}

export default function TalksHome({ rooms, initial, canHost, startRoom }) {
  const router = useRouter();
  const [live, setLive] = useState(initial);
  const [sheet, setSheet] = useState(!!startRoom);
  const [room, setRoom] = useState(rooms.find((r) => r.slug === startRoom)?.slug || rooms[0]?.slug);
  const [topic, setTopic] = useState('');
  const [onWall, setOnWall] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const sb = browserClient();
    let alive = true;
    const tick = async () => {
      const { data } = await sb.rpc('talks_live');
      if (alive && Array.isArray(data)) setLive(data);
    };
    const id = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function go() {
    setErr('');
    const t = topic.trim();
    if (!t) { setErr('Give it a topic first.'); return; }
    setBusy(true);
    const { data, error } = await browserClient().rpc('talk_start', { p_room_slug: room, p_topic: t, p_on_wall: onWall });
    setBusy(false);
    if (error) { setErr(error.message || 'Couldn’t start it. Try again.'); return; }
    router.push(`/talks/${data}`);
  }

  const picked = rooms.find((r) => r.slug === room);

  return (
    <div className="tk-page">
      <header className="tk-top">
        <nav className="tk-rooms" aria-label="Rooms">
          {rooms.map((r) => (
            <Link key={r.slug} href={`/friends?room=${r.slug}`} className="tk-rm">
              <span className="tk-ri" aria-hidden="true">{r.emoji}</span>{r.name.replace(/^The /, '')}
            </Link>
          ))}
          <span className="tk-rm lv on"><span className="tk-ri" aria-hidden="true">🎙️</span>Live{live.length > 0 && <span className="tk-dot" />}</span>
        </nav>
        <div className="tk-hero">
          <span className="tk-cover" aria-hidden="true">🎙️</span>
          <span className="tk-ht"><b>Talk Rooms</b><small>Live voice, with people who get it</small></span>
        </div>
      </header>

      <div className="tk-pad">
        {canHost ? (
          <button type="button" className="tk-startcard" onClick={() => setSheet(true)}>
            <span className="tk-si" aria-hidden="true">🎙️</span>
            <span className="tk-sx"><b>Start a talk</b><small>Pick a topic. People drop in.</small></span>
            <em>Go live</em>
          </button>
        ) : (
          <div className="tk-startcard off">
            <span className="tk-si" aria-hidden="true">🎙️</span>
            <span className="tk-sx"><b>Hosting opens at 90 days</b><small>Until then, jump into any talk and raise your hand.</small></span>
          </div>
        )}

        <p className="tk-h2">Live now</p>
        {live.length === 0 && (
          <div className="tk-empty">Nobody's live right now.{canHost ? ' Start one — people will drop in.' : ' Check back soon.'}</div>
        )}
        {live.map((t) => (
          <div className="tk-talk" key={t.id}>
            <div className="tk-row1">
              <span className="tk-livetag"><i />LIVE</span>
              <span className="tk-rn">{t.room.emoji} {t.room.name.replace(/^The /, '')}</span>
              <span className="tk-kind">🎧 Voice{t.room.anonymous ? ' · 🎭' : ''} · {mins(t.started_at)}</span>
            </div>
            <h3>{t.topic}</h3>
            <div className="tk-row2">
              <span className="tk-faces">
                {(t.speakers || []).slice(0, 3).map((n, i) => (
                  <span key={i} className={t.room.anonymous ? 'anon' : ''}>{t.room.anonymous ? '🎭' : n.slice(0, 1).toUpperCase()}</span>
                ))}
              </span>
              <span className="tk-who">{who(t)}<br />{t.listening} listening</span>
              <Link className="tk-join" href={`/talks/${t.id}`}>Join</Link>
            </div>
          </div>
        ))}
        <p className="tk-foot">🔒 Nothing is recorded. Listening is quiet: you're counted, not named.</p>
      </div>

      {sheet && (
        <div className="tk-scrim" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div className="tk-sheet" role="dialog" aria-label="Start a talk">
            <div className="tk-grab" />
            <h2>🎙️ Start a talk</h2>
            <p className="tk-sub">It shows up in the room{onWall ? ' and on the wall' : ''}. Anyone can come listen.</p>

            <p className="tk-fl">What's it about?</p>
            <input className="tk-field" maxLength={80} value={topic} placeholder="Getting through the holidays sober"
                   onChange={(e) => setTopic(e.target.value)} />
            <div className="tk-chips">
              {TOPICS.map((x) => (
                <button key={x} type="button" className="tk-chip" onClick={() => setTopic(x.replace(/^\S+\s/, ''))}>{x}</button>
              ))}
            </div>

            <p className="tk-fl">Where?</p>
            <div className="tk-chips">
              {rooms.map((r) => (
                <button key={r.slug} type="button" className={'tk-chip' + (r.slug === room ? ' on' : '')} onClick={() => setRoom(r.slug)}>
                  {r.emoji} {r.name.replace(/^The /, '')}{r.anonymous ? ' · room names' : ''}
                </button>
              ))}
            </div>
            {picked?.anonymous && <p className="tk-mask">🎭 Everybody in this talk goes by their room name, including you. No faces, no day counts.</p>}

            <button type="button" className="tk-tog" onClick={() => setOnWall(!onWall)}>
              <span className="tk-tx">Say it on the wall<small>"🔴 Live: {topic.trim() || 'your topic'}"</small></span>
              <span className={'tk-sw' + (onWall ? ' on' : '')} />
            </button>
            <div className="tk-tog">
              <span className="tk-tx">Record it<small>Off, always. What's said here stays here.</small></span>
              <span className="tk-sw lock" />
            </div>

            {err && <p className="tk-err">{err}</p>}
            <button type="button" className="tk-go" disabled={busy} onClick={go}>{busy ? 'Going live…' : '🔴 Go live'}</button>
            <button type="button" className="tk-cancel" onClick={() => setSheet(false)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
