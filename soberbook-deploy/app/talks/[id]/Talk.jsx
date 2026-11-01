'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '../../../lib/supabase-browser';
import { TalkLine } from '../../../lib/talk-rtc';
import { COINS } from '../../../lib/coins';
import Coin from '../../components/Coin';

/* =====================================================================
   INSIDE A TALK. 1 Nov 2026 — the approved "Talk Rooms" prototype.

   ⭐ THE DATABASE IS THE TRUTH, THE SOUND FOLLOWS IT. Every 2.5s
   talk_state() says who is on stage, who is muted, who has a hand up; this
   component makes the sound line match: publish when you're brought up,
   stop when you're moved down, pull every speaker, drop anybody who left.

   ⚠️ A TAP COMES FIRST. iPhones won't play sound or open the mic until a
   person touches the page, so arriving shows the topic and one big
   button. That tap is also where a listener chooses to be named or not.

   ⚠️ YOUR OWN MUTE WINS FOR 4 SECONDS. Tapping the mic writes to the
   database, but a poll already in flight can come back with the old value
   and flip the button back. `mutedAt` ignores the server's word on your
   own mute until your write has had time to land.
   ===================================================================== */

const POLL = 2500;
const COIN_WORD = Object.fromEntries(COINS.map((c) => [c.kind, c.name]));

function dayLabel(d) {
  if (d == null) return null;
  if (d >= 730) return `${Math.floor(d / 365)} yrs`;
  if (d >= 365) return '1 yr';
  return d === 1 ? '1 day' : `${d} days`;
}

export default function Talk({ id, initial }) {
  const router = useRouter();
  const sb = useRef(null);
  const line = useRef(null);
  const audios = useRef(new Map());
  const box = useRef(null);
  const mutedAt = useRef(0);
  const busyPub = useRef(false);
  const feedEnd = useRef(null);

  const [s, setS] = useState(initial);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [named, setNamed] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [levels, setLevels] = useState({});
  const [sheet, setSheet] = useState(null);   // { seat, name, host, me } | 'hands'
  const [say, setSay] = useState('');
  const [note, setNote] = useState('');
  const [needTap, setNeedTap] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!sb.current && typeof window !== 'undefined') sb.current = browserClient();

  const flash = useCallback((t) => { setNote(t); setTimeout(() => setNote(''), 4000); }, []);
  const rpc = useCallback(async (fn, args) => {
    const { data, error } = await sb.current.rpc(fn, args);
    if (error) { flash(error.message || 'That didn’t work. Try again.'); throw error; }
    return data;
  }, [flash]);

  /* ---------- sound in ---------- */
  const onRemote = useCallback((key, stream) => {
    let el = audios.current.get(key);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      box.current?.appendChild(el);
      audios.current.set(key, el);
    }
    el.srcObject = stream;
    el.play().catch(() => setNeedTap(true));
  }, []);
  const onGone = useCallback((key) => {
    const el = audios.current.get(key);
    if (el) { el.srcObject = null; el.remove(); audios.current.delete(key); }
  }, []);

  /* ---------- the loop ---------- */
  const reconcile = useCallback(async (st) => {
    const l = line.current;
    if (!l) return;
    if (st.ended || st.removed || st.gone) { l.close(); line.current = null; return; }
    const me = st.me;
    if (!me) return;

    if (me.role === 'speaker' && !l.publishing && !busyPub.current) {
      busyPub.current = true;
      try {
        await l.publish();
        flash(me.host ? 'You’re live. Tap the mic when you’re ready to talk.' : 'You’re on stage! Tap the mic to talk.');
      } catch (e) {
        flash(e?.name === 'NotAllowedError'
          ? 'Sober Book needs your microphone to put you on stage. Allow it in your settings.'
          : 'Couldn’t start your mic. Try again.');
        if (!me.host) await sb.current.rpc('talk_move_down', { p_talk: id, p_seat: null });
      } finally { busyPub.current = false; }
    }
    if (me.role === 'listener' && l.publishing) {
      await l.unpublish();
      setMicOn(false);
    }
    if (me.muted && Date.now() - mutedAt.current > 4000) {
      l.setMic(false);
      setMicOn((was) => { if (was && me.host_muted) flash('The host muted you.'); return false; });
    }
    try {
      await l.sync((st.speakers || []).filter((x) => !x.me));
    } catch {}
  }, [id, flash]);

  useEffect(() => {
    if (!joined) return undefined;
    let alive = true;
    const tick = async () => {
      const { data } = await sb.current.rpc('talk_state', { p_talk: id });
      if (!alive || !data) return;
      setS(data);
      reconcile(data);
    };
    tick();
    const t1 = setInterval(tick, POLL);
    const t2 = setInterval(async () => {
      if (line.current) setLevels(await line.current.levels());
    }, 300);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, [joined, id, reconcile]);

  useEffect(() => () => { line.current?.close(); line.current = null; }, []);
  useEffect(() => { feedEnd.current?.scrollIntoView({ block: 'end' }); }, [s.feed?.length]);

  /* ---------- actions ---------- */
  async function join() {
    setJoining(true);
    try {
      await rpc('talk_join', { p_talk: id, p_quiet: !named });
      const l = new TalkLine(id, { onRemote, onGone });
      await l.start();
      line.current = l;
      setJoined(true);
    } catch (e) {
      if (!note) flash(e?.message || 'Couldn’t get in. Try again.');
    } finally { setJoining(false); }
  }

  async function toggleMic() {
    const on = !micOn;
    mutedAt.current = Date.now();
    line.current?.setMic(on);
    setMicOn(on);
    await sb.current.rpc('talk_mute', { p_talk: id, p_muted: !on });
  }

  async function hand(up) { await rpc('talk_hand', { p_talk: id, p_up: up }).catch(() => {}); setS((x) => ({ ...x, me: { ...x.me, hand: up } })); }

  async function leave() {
    if (s.me?.host && !confirmEnd) { setConfirmEnd(true); setTimeout(() => setConfirmEnd(false), 4000); return; }
    await sb.current.rpc(s.me?.host ? 'talk_end' : 'talk_leave', { p_talk: id });
    line.current?.close(); line.current = null;
    router.push('/talks');
  }

  async function send(e) {
    e.preventDefault();
    const b = say.trim();
    if (!b) return;
    setSay('');
    await rpc('talk_say', { p_talk: id, p_body: b }).catch(() => setSay(b));
  }

  async function coin(seat, kind) {
    setSheet(null);
    await rpc('talk_coin', { p_talk: id, p_seat: seat, p_kind: kind }).catch(() => {});
  }

  async function mod(fn, seat) {
    setSheet(null);
    await rpc(fn, { p_talk: id, p_seat: seat }).catch(() => {});
  }

  function unlockSound() {
    audios.current.forEach((el) => el.play().catch(() => {}));
    setNeedTap(false);
  }

  /* ---------- render ---------- */
  const room = s.room || {};
  const anon = !!room.anonymous;
  const speakers = s.speakers || [];
  const me = s.me;
  const others = speakers.filter((x) => !x.me);
  const levelFor = (sp) => (sp.me ? levels.me : levels[`${sp.session}:${sp.track}`]) || 0;

  if (s.removed) {
    return (
      <div className="tk-page tk-endcard">
        <div className="tk-big">🚪</div>
        <h2>The host asked you to leave this talk.</h2>
        <Link className="tk-go" href="/friends">Back to the rooms</Link>
      </div>
    );
  }
  if (s.ended) {
    return (
      <div className="tk-page tk-endcard">
        <div className="tk-big">🎙️</div>
        <h2>This talk has ended.</h2>
        <p className="tk-sub">“{s.topic}” · thanks for being there.</p>
        <Link className="tk-go" href="/talks">See what’s live</Link>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="tk-page tk-gate">
        <Link href="/talks" className="tk-back" aria-label="Back">‹</Link>
        <span className="tk-livetag big"><i />LIVE</span>
        <p className="tk-gate-room">{room.emoji} {room.name}</p>
        <h1>{s.topic}</h1>
        <p className="tk-gate-who">
          {speakers.map((x) => x.name).join(', ') || 'Starting up'} · {s.listening} listening
        </p>
        {!me?.host && (
          <button type="button" className="tk-tog" onClick={() => setNamed(!named)}>
            <span className="tk-tx">Show my {anon ? 'room name' : 'name'} to the room
              <small>{named ? 'People will see you came in.' : 'Off: you’re counted, not named.'}</small></span>
            <span className={'tk-sw' + (named ? ' on' : '')} />
          </button>
        )}
        {note && <p className="tk-err">{note}</p>}
        <button type="button" className="tk-go" disabled={joining} onClick={join}>
          {joining ? 'Connecting…' : me?.host ? '🎙️ Open your talk' : '🎧 Listen in'}
        </button>
        <p className="tk-foot">🔒 Nothing is recorded. What’s said here stays here.</p>
      </div>
    );
  }

  const seatsOpen = Math.max(0, 4 - speakers.length);

  return (
    <div className="tk-page tk-in">
      <div ref={box} hidden />
      <div className="tk-stagetop">
        <Link href="/talks" className="tk-back" aria-label="Back to Talk Rooms">‹</Link>
        <span className="tk-tt"><b>{s.topic}</b>
          <small><span className="tk-livetag"><i />LIVE</span>{room.emoji} {room.name?.replace(/^The /, '')}</small></span>
        <button type="button" className={'tk-leave' + (confirmEnd ? ' sure' : '')} onClick={leave}>
          {me?.host ? (confirmEnd ? 'Tap to end' : 'End') : 'Leave'}
        </button>
      </div>

      <div className="tk-guide">📌 <span><b>Talk guide:</b> one at a time, no fixing unless asked, nothing is recorded. 💚</span>
        <a href="tel:988" className="tk-988">🆘 988</a></div>

      {needTap && <button type="button" className="tk-unlock" onClick={unlockSound}>🔈 Tap to hear the room</button>}

      <div className="tk-stage">
        {speakers.map((sp) => {
          const lv = levelFor(sp);
          const talking = !sp.muted && lv > 0.02;
          return (
            <button type="button" key={sp.seat} className={'tk-tile' + (talking ? ' talking' : '')}
                    onClick={() => setSheet(sp)}>
              {sp.host && <span className="tk-host">HOST</span>}
              {talking && <span className="tk-bars"><i /><i /><i /></span>}
              <span className="tk-bigav">{anon ? '🎭' : (sp.name || '?').slice(0, 1).toUpperCase()}</span>
              <span className="tk-nm">{sp.me ? 'You' : sp.name}
                {dayLabel(sp.day) && <span className="tk-d">🌱 {dayLabel(sp.day)}</span>}
                {sp.muted && <span className="tk-mu" aria-label="muted">🔇</span>}</span>
            </button>
          );
        })}
        {seatsOpen > 0 && (
          <div className="tk-tile open"><span><span className="tk-e">✋</span>Open seat<br />{me?.role === 'speaker' ? 'Others can raise a hand' : 'Raise your hand to talk'}</span></div>
        )}
      </div>

      <div className="tk-listen">
        <span className="tk-faces">{(s.faces || []).map((f, i) => <span key={i}>{anon ? '🎭' : f.toUpperCase()}</span>)}</span>
        <small><b>{s.listening} listening</b>{s.quiet ? ` · ${s.quiet} quietly` : ''}</small>
        {s.mod ? (
          <button type="button" className="tk-hands" onClick={() => setSheet('hands')}>✋ {s.hand_count || 0}</button>
        ) : (s.hand_count > 0 && <span className="tk-hands">✋ {s.hand_count}</span>)}
      </div>

      <div className="tk-feed">
        {(s.feed || []).map((f) => (
          f.kind === 'join' ? <div key={f.id} className="tk-fm fj"><p>👋 {f.name} came in to listen</p></div>
          : f.kind === 'coin' ? (
            <div key={f.id} className="tk-fm tk-coinmsg"><p><Coin kind={f.coin} size={18} />
              <span><b>{f.me ? 'You' : f.name}</b> sent {f.to || 'someone'} a {COIN_WORD[f.coin] || 'coin'} coin</span></p></div>
          ) : (
            <div key={f.id} className={'tk-fm' + (f.me ? ' mine' : '')}><p><b>{f.me ? 'You' : f.name}</b>{f.body}</p></div>
          )
        ))}
        <div ref={feedEnd} />
      </div>

      {note && <p className="tk-note">{note}</p>}

      <form className="tk-controls" onSubmit={send}>
        <input className="tk-cin" value={say} maxLength={300} placeholder="Say something…" onChange={(e) => setSay(e.target.value)} />
        <button type="button" className="tk-ctl gold" aria-label="Send a coin"
                onClick={() => (others.length === 1 ? setSheet(others[0]) : flash(others.length ? 'Tap someone on stage to send them a coin.' : 'Nobody else is on stage yet.'))}>
          <Coin kind="proud" size={22} />
        </button>
        {me?.role === 'speaker' ? (
          <button type="button" className={'tk-ctl mic' + (micOn ? ' on' : '')} onClick={toggleMic}
                  aria-label={micOn ? 'Mute' : 'Unmute'}>{micOn ? '🎙️' : '🔇'}</button>
        ) : (
          <button type="button" className={'tk-ctl hand' + (me?.hand ? ' up' : '')} onClick={() => hand(!me?.hand)}>
            ✋ {me?.hand ? 'Hand up' : 'Raise hand'}</button>
        )}
      </form>

      {sheet && (
        <div className="tk-scrim" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="tk-sheet small">
            <div className="tk-grab" />
            {sheet === 'hands' ? (
              <>
                <h2>✋ Want to talk</h2>
                {(s.hands || []).length === 0 && <p className="tk-sub">No hands up right now.</p>}
                {(s.hands || []).map((h) => (
                  <div className="tk-handrow" key={h.seat}>
                    <span className="tk-bigav sm">{anon ? '🎭' : h.name.slice(0, 1).toUpperCase()}</span>
                    <span className="tk-tx">{h.name}{dayLabel(h.day) && <small>🌱 {dayLabel(h.day)}</small>}</span>
                    <button type="button" className="tk-join" disabled={seatsOpen === 0}
                            onClick={() => mod('talk_bring_up', h.seat)}>Bring up</button>
                  </div>
                ))}
                {seatsOpen === 0 && <p className="tk-sub">All 4 seats are full. Move someone down first.</p>}
              </>
            ) : (
              <>
                <h2>{sheet.me ? 'You' : sheet.name}</h2>
                {!sheet.me && (
                  <>
                    <p className="tk-fl">Send a coin</p>
                    <div className="tk-coins">
                      {COINS.map((c) => (
                        <button type="button" key={c.kind} className="tk-coinbtn" onClick={() => coin(sheet.seat, c.kind)}>
                          <Coin kind={c.kind} size={34} /><span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {sheet.me && !sheet.host && (
                  <button type="button" className="tk-act" onClick={() => mod('talk_move_down', null)}>⬇️ Step down to listening</button>
                )}
                {s.mod && !sheet.me && !sheet.host && (
                  <>
                    <p className="tk-fl">Host tools</p>
                    <button type="button" className="tk-act" onClick={() => mod('talk_host_mute', sheet.seat)}>🔇 Mute them</button>
                    <button type="button" className="tk-act" onClick={() => mod('talk_move_down', sheet.seat)}>⬇️ Move down to listening</button>
                    <button type="button" className="tk-act red" onClick={() => mod('talk_remove', sheet.seat)}>🚪 Remove from the talk</button>
                  </>
                )}
              </>
            )}
            <button type="button" className="tk-cancel" onClick={() => setSheet(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
