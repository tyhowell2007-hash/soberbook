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
   2 Nov 2026 — TALK ROOMS LIVE (migration 0201): camera or voice, ask to
   join, the host says yes. Ty: "I want to take the TikTok aspect of being
   able to hold a room ... but you have to approve them to come in."

   ⭐ THE DATABASE IS THE TRUTH, THE SOUND AND PICTURE FOLLOW IT. Every
   2.5s talk_state() says who is on stage, who is muted, whose camera is
   on, who is asking; this component makes the line match: publish when
   you're brought up, stop when you're moved down, pull every speaker's
   mic and camera, drop anybody who left.

   ⭐ NOBODY COMES UP WITHOUT A YES. Listeners ask (camera or voice, an
   optional note). The host sees the ask with the note and says Bring up,
   Voice only, or not now.

   ⭐ THE WALK-UP. A listener who gets a yes sees a three-second countdown
   before anything goes out — joining MUTED, camera their choice, and a
   "Stay listening" way out. Nothing publishes while it runs.

   ⚠️ A TAP COMES FIRST. iPhones won't play sound or open the mic until a
   person touches the page, so arriving shows the topic and one big
   button. That tap is also where a listener chooses to be named or not.

   ⚠️ YOUR OWN MUTE WINS FOR 4 SECONDS (mutedAt) — a poll already in
   flight can come back with the old value and flip the button back.

   🎭 Anonymous rooms: no cameras anywhere. The database refuses them; this
   file just never offers one.
   ===================================================================== */

const POLL = 2500;
const COIN_WORD = Object.fromEntries(COINS.map((c) => [c.kind, c.name]));
const TINTS = ['#9BE3BC', '#F7D58A', '#C9B6FF', '#FFB4A2', '#9AD7FF'];

function dayLabel(d) {
  if (d == null) return null;
  if (d >= 730) return `${Math.floor(d / 365)} yrs`;
  if (d >= 365) return '1 yr';
  return d === 1 ? '1 day' : `${d} days`;
}
function tint(name) {
  let h = 0;
  for (const c of name || '?') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/* a <video> that shows a stream; muted because sound goes through <audio> */
function Cam({ stream, mirror }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream || null;
    if (stream) v.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} className={'tk-vid' + (mirror ? ' mirror' : '')} autoPlay playsInline muted />;
}

export default function Talk({ id, initial }) {
  const router = useRouter();
  const sb = useRef(null);
  const line = useRef(null);
  const audios = useRef(new Map());
  const box = useRef(null);
  const mutedAt = useRef(0);
  const busyPub = useRef(false);
  const busyCam = useRef(false);
  const feedEnd = useRef(null);
  const walking = useRef(false);
  const lastRole = useRef(initial?.me?.role || null);
  const hostCamTried = useRef(false);

  const [s, setS] = useState(initial);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [named, setNamed] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [levels, setLevels] = useState({});
  const [videos, setVideos] = useState({});      // key -> MediaStream
  const [myCam, setMyCam] = useState(null);      // my own camera, for my tile
  const [sheet, setSheet] = useState(null);      // speaker | 'requests' | 'ask'
  const [say, setSay] = useState('');
  const [note, setNote] = useState('');
  const [needTap, setNeedTap] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [walk, setWalk] = useState(null);        // { left, cam }
  // the ask sheet
  const [askMode, setAskMode] = useState('voice');
  const [askNote, setAskNote] = useState('');
  const [preview, setPreview] = useState(null);
  /* 0204 — the host can lock the talk so nobody new joins. */
  const [locked, setLocked] = useState(false);

  if (!sb.current && typeof window !== 'undefined') sb.current = browserClient();

  const flash = useCallback((t) => { setNote(t); setTimeout(() => setNote(''), 4000); }, []);
  useEffect(() => {
    sb.current?.rpc('talk_locked', { p_talk: id }).then(({ data }) => setLocked(data === true)).catch(() => {});
  }, [id]);
  const rpc = useCallback(async (fn, args) => {
    const { data, error } = await sb.current.rpc(fn, args);
    if (error) { flash(error.message || 'That didn’t work. Try again.'); throw error; }
    return data;
  }, [flash]);

  /* ---------- sound and picture in ---------- */
  const onRemote = useCallback((key, stream, kind) => {
    if (kind === 'video') { setVideos((v) => ({ ...v, [key]: stream })); return; }
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
    setVideos((v) => { if (!v[key]) return v; const n = { ...v }; delete n[key]; return n; });
    const el = audios.current.get(key);
    if (el) { el.srcObject = null; el.remove(); audios.current.delete(key); }
  }, []);

  /* ---------- the loop ---------- */
  const reconcile = useCallback(async (st) => {
    const l = line.current;
    if (!l) return;
    if (st.ended || st.removed || st.gone) { l.close(); line.current = null; setMyCam(null); return; }
    const me = st.me;
    if (!me) return;

    // a yes just came in: walk up first, publish after
    if (lastRole.current === 'listener' && me.role === 'speaker' && !me.host) {
      walking.current = true;
      setWalk({ left: 3, cam: !!me.cam_ok });
      setSheet(null);
    }
    lastRole.current = me.role;

    if (me.role === 'speaker' && !walking.current && !l.publishing && !busyPub.current) {
      busyPub.current = true;
      try {
        await l.publish();
        flash(me.host ? 'You’re live. Tap the mic when you’re ready to talk.' : 'You’re on stage, muted. Tap the mic to talk.');
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

    // camera follows the database: on only if you're up, allowed, and switched it on
    const camWanted = me.role === 'speaker' && me.cam_ok && me.cam_on && !me.host_cam_off && !walking.current;
    if (camWanted && !l.camPublishing && !busyCam.current) {
      busyCam.current = true;
      try { await l.publishCam(); setMyCam(l.camStream); }
      catch (e) {
        flash(e?.name === 'NotAllowedError' ? 'Allow the camera in your settings to show your face.' : 'Couldn’t start your camera.');
        await sb.current.rpc('talk_camera', { p_talk: id, p_on: false }).catch(() => {});
      } finally { busyCam.current = false; }
    }
    if (!camWanted && l.camPublishing && !busyCam.current) {
      busyCam.current = true;
      try { await l.unpublishCam(); } finally { busyCam.current = false; }
      setMyCam(null);
      if (me.host_cam_off) flash('The host turned your camera off. You’re still on voice.');
    }

    if (me.muted && Date.now() - mutedAt.current > 4000) {
      l.setMic(false);
      setMicOn((was) => { if (was && me.host_muted) flash('The host muted you.'); return false; });
    }
    const pulls = [];
    for (const x of st.speakers || []) {
      if (x.me) continue;
      if (x.track) pulls.push({ session: x.session, track: x.track });
      if (x.cam) pulls.push({ session: x.session, track: x.cam });
    }
    try { await l.sync(pulls); } catch {}
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

  /* ---------- the walk-up countdown ---------- */
  useEffect(() => {
    if (!walk) return undefined;
    if (walk.left <= 0) {
      walking.current = false;
      const cam = walk.cam;
      setWalk(null);
      if (cam) sb.current.rpc('talk_camera', { p_talk: id, p_on: true }).then(() => {});
      return undefined;
    }
    const t = setTimeout(() => setWalk((w) => (w ? { ...w, left: w.left - 1 } : w)), 1000);
    return () => clearTimeout(t);
  }, [walk, id]);

  async function stayListening() {
    walking.current = false;
    setWalk(null);
    await rpc('talk_move_down', { p_talk: id, p_seat: null }).catch(() => {});
  }

  /* ---------- the ask sheet's private preview ---------- */
  useEffect(() => {
    if (sheet !== 'ask' || askMode !== 'camera') { setPreview(null); return undefined; }
    let stream = null;
    let alive = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 } }, audio: false })
      .then((st) => { if (!alive) { st.getTracks().forEach((t) => t.stop()); return; } stream = st; setPreview(st); })
      .catch(() => { if (alive) flash('Allow the camera to check how you look. You can still ask on voice.'); });
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); setPreview(null); };
  }, [sheet, askMode, flash]);

  /* ---------- actions ---------- */
  async function join() {
    setJoining(true);
    try {
      await rpc('talk_join', { p_talk: id, p_quiet: !named });
      const l = new TalkLine(id, { onRemote, onGone });
      await l.start();
      line.current = l;
      // a host who went live "on camera" starts with the camera on
      if (s.me?.host && s.kind === 'video' && !s.room?.anonymous && !hostCamTried.current) {
        hostCamTried.current = true;
        await sb.current.rpc('talk_camera', { p_talk: id, p_on: true });
      }
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

  async function toggleCam() {
    const on = !s.me?.cam_on;
    await rpc('talk_camera', { p_talk: id, p_on: on }).catch(() => {});
    setS((x) => ({ ...x, me: { ...x.me, cam_on: on } }));
  }

  async function flip() {
    try { await line.current?.flipCam(); setMyCam(line.current?.camStream || null); } catch { flash('Couldn’t switch cameras.'); }
  }

  async function ask() {
    await rpc('talk_ask', { p_talk: id, p_mode: anon ? 'voice' : askMode, p_note: askNote.trim() || null }).catch(() => null);
    setSheet(null);
    setS((x) => ({ ...x, me: { ...x.me, hand: true, ask_mode: askMode } }));
    flash('Asked. You’ll keep listening until the host says yes.');
  }

  async function cancelAsk() {
    await rpc('talk_hand', { p_talk: id, p_up: false }).catch(() => {});
    setS((x) => ({ ...x, me: { ...x.me, hand: false, ask_mode: null } }));
  }

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

  async function mod(fn, seat, extra = {}) {
    if (fn !== 'talk_bring_up' && fn !== 'talk_decline') setSheet(null);
    await rpc(fn, { p_talk: id, p_seat: seat, ...extra }).catch(() => {});
    const { data } = await sb.current.rpc('talk_state', { p_talk: id });
    if (data) setS(data);
  }

  /* 0204 — lock / unlock (host only; the database checks). */
  async function toggleLock() {
    const next = !locked;
    const { error } = await sb.current.rpc('talk_lock', { p_talk: id, p_on: next });
    if (error) { flash('Only the host can lock the talk.'); return; }
    setLocked(next);
    flash(next ? 'Locked. Nobody new can join.' : 'Unlocked. People can join again.');
  }

  /* 0204 — report someone on stage. Goes to Ty and Kenny's safety queue. */
  async function reportSeat(seat) {
    setSheet(null);
    const { error } = await sb.current.rpc('report_talk_seat', { p_talk: id, p_seat: seat });
    flash(error ? 'That didn’t go through. Try again.' : 'Reported. Ty and Kenny can see it right now. You can leave any time.');
  }

  async function setWho(who) {
    await rpc('talk_set_requests', { p_talk: id, p_who: who }).catch(() => {});
    setS((x) => ({ ...x, requests: who }));
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
  const videoFor = (sp) => (sp.me ? myCam : (sp.cam ? videos[`${sp.session}:${sp.cam}`] : null));

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
        <p className="tk-gate-room">{room.emoji} {room.name}{s.kind === 'video' && !anon ? ' · 🎥 Camera' : ' · 🎧 Voice'}</p>
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
          {joining ? 'Connecting…' : me?.host ? (s.kind === 'video' && !anon ? '🎥 Open your talk' : '🎙️ Open your talk') : '🎧 Listen in'}
        </button>
        <p className="tk-foot">🔒 Nothing is recorded, and please don&rsquo;t record or screenshot. Listeners are never on camera.</p>
      </div>
    );
  }

  const hostSp = speakers.find((x) => x.host) || speakers[0];
  const rail = speakers.filter((x) => x !== hostSp);
  const seatsOpen = Math.max(0, 4 - speakers.length);
  const hands = s.hands || [];

  const tile = (sp, big) => {
    const lv = levelFor(sp);
    const talking = !sp.muted && lv > 0.02;
    const v = videoFor(sp);
    const nm = sp.me ? 'You' : sp.name;
    return (
      <button type="button" key={sp.seat} className={'tk-seat' + (big ? ' hero' : '') + (talking ? ' talking' : '') + (v ? ' cam' : '')}
              onClick={() => setSheet(sp)}>
        {v ? <Cam stream={v} mirror={sp.me} /> : (
          <span className="tk-vo" style={{ '--tk-tint': anon ? '#2A3D33' : tint(sp.name) }}>
            <span className="tk-voav">{anon ? '🎭' : (sp.name || '?').slice(0, 1).toUpperCase()}</span>
          </span>
        )}
        {sp.host && <span className="tk-host">HOST</span>}
        {talking && <span className="tk-bars"><i /><i /><i /></span>}
        <span className="tk-nm">{nm}
          {!big && dayLabel(sp.day) && <span className="tk-d">🌱 {dayLabel(sp.day)}</span>}
          <span className="tk-mu" aria-label={sp.muted ? 'muted' : (v ? 'camera' : 'voice')}>{sp.muted ? '🔇' : (v ? '🎥' : '🎙')}</span></span>
      </button>
    );
  };

  return (
    <div className="tk-page tk-in tk-live">
      <div ref={box} hidden />

      {/* the host fills the top */}
      <div className="tk-heroWrap">
        {hostSp && tile(hostSp, true)}
        <div className="tk-hhdr">
          <Link href="/talks" className="tk-glassbtn" aria-label="Back to Talk Rooms">‹</Link>
          <span className="tk-livetag"><i />LIVE</span>
          <span className="tk-htopic">{s.topic}</span>
          <span className="tk-gcount">🎧 {s.listening}</span>
          <button type="button" className={'tk-leave' + (confirmEnd ? ' sure' : '')} onClick={leave}>
            {me?.host ? (confirmEnd ? 'Tap to end' : 'End') : 'Leave'}
          </button>
        </div>
        <div className="tk-hroom">{room.emoji} {room.name?.replace(/^The /, '')}{hostSp && dayLabel(hostSp.day) ? ` · ${hostSp.name} 🌱 ${dayLabel(hostSp.day)}` : ''}</div>
      </div>

      {/* the stage under the host: up to three more seats */}
      <div className="tk-rail">
        {rail.map((sp) => tile(sp, false))}
        {seatsOpen > 0 && (
          s.mod ? (
            <button type="button" className="tk-seat open" onClick={() => setSheet('requests')}>
              <span><span className="tk-plus">+</span><b>Open seat</b><small>{hands.length ? `${hands.length} asking` : 'Nobody asking yet'}</small></span>
            </button>
          ) : me?.role === 'listener' ? (
            <button type="button" className="tk-seat open" disabled={!s.can_ask && !me?.hand}
                    onClick={() => (me?.hand ? null : setSheet('ask'))}>
              <span><span className="tk-plus">{me?.hand ? '⏳' : '+'}</span>
                <b>{me?.hand ? 'You asked' : s.can_ask ? 'Ask to join' : 'Not taking requests'}</b>
                <small>{me?.hand ? 'Waiting for the host' : `${seatsOpen} seat${seatsOpen === 1 ? '' : 's'} open`}</small></span>
            </button>
          ) : (
            <div className="tk-seat open"><span><span className="tk-plus">+</span><b>Open seat</b><small>The host brings people up</small></span></div>
          )
        )}
      </div>

      <div className="tk-guide">📌 <span><b>Talk guide:</b> one at a time, no fixing unless asked, nothing is recorded. 💚</span>
        <a href="tel:988" className="tk-988">🆘 988</a></div>

      {needTap && <button type="button" className="tk-unlock" onClick={unlockSound}>🔈 Tap to hear the room</button>}

      <div className="tk-feed">
        {(s.feed || []).map((f) => (
          f.kind === 'join' ? <div key={f.id} className="tk-fm fj"><p>👋 {f.name} came in to listen</p></div>
          : f.kind === 'up' ? <div key={f.id} className="tk-fm fu"><p>✓ {f.me ? 'You' : f.name} came up on {f.body === 'camera' ? 'camera' : 'voice'}</p></div>
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
        <input className="tk-cin" value={say} maxLength={300} placeholder={me?.role === 'speaker' || s.mod ? 'Say something…' : 'Say something kind…'} onChange={(e) => setSay(e.target.value)} />
        <button type="button" className="tk-ctl gold" aria-label="Send a coin"
                onClick={() => (others.length === 1 ? setSheet(others[0]) : flash(others.length ? 'Tap someone on stage to send them a coin.' : 'Nobody else is on stage yet.'))}>
          <Coin kind="proud" size={22} />
        </button>
        {me?.host && (
          <button type="button" className="tk-ctl" aria-label={locked ? 'Unlock the talk' : 'Lock the talk'} onClick={toggleLock}>
            {locked ? '🔒' : '🔓'}
          </button>
        )}
        {s.mod && (
          <button type="button" className="tk-ctl req" aria-label="People asking to join" onClick={() => setSheet('requests')}>
            ✋{hands.length > 0 && <span className="tk-badge">{hands.length}</span>}
          </button>
        )}
        {me?.role === 'speaker' ? (
          <>
            {me.cam_ok && !anon && (
              <button type="button" className={'tk-ctl cam' + (me.cam_on ? ' on' : '')} onClick={toggleCam}
                      disabled={me.host_cam_off} aria-label={me.cam_on ? 'Camera off' : 'Camera on'}>{me.cam_on ? '🎥' : '📷'}</button>
            )}
            {me.cam_on && myCam && <button type="button" className="tk-ctl" onClick={flip} aria-label="Flip camera">🔄</button>}
            <button type="button" className={'tk-ctl mic' + (micOn ? ' on' : '')} onClick={toggleMic}
                    aria-label={micOn ? 'Mute' : 'Unmute'}>{micOn ? '🎙️' : '🔇'}</button>
          </>
        ) : me?.hand ? (
          <button type="button" className="tk-ctl hand up" onClick={cancelAsk}>⏳ Asked · cancel</button>
        ) : (
          <button type="button" className="tk-ctl hand" disabled={!s.can_ask} onClick={() => setSheet('ask')}>
            ✋ {s.can_ask ? 'Ask to join' : 'Closed'}</button>
        )}
      </form>

      {/* ---------- the walk-up ---------- */}
      {walk && (
        <div className="tk-walk">
          <div className="tk-cd"><svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="68" className="tk-cdbg" /><circle cx="75" cy="75" r="68" className="tk-cdring" /></svg>
            <span className="tk-cdn">{walk.left}</span></div>
          <h2>{hostSp?.me ? 'You’re up' : `${hostSp?.name || 'The host'} brought you up`}</h2>
          <p className="tk-sub">Take a breath. You’re joining muted, so unmute when you’re ready.</p>
          {walk.cam && !anon ? (
            <button type="button" className="tk-tog" onClick={() => setWalk((w) => ({ ...w, cam: !w.cam }))}>
              <span className="tk-tx">🎥 Camera on<small>{walk.cam ? 'People will see you.' : 'Voice only.'}</small></span>
              <span className={'tk-sw' + (walk.cam ? ' on' : '')} />
            </button>
          ) : (
            <p className="tk-mask">🎙 You’re coming up on voice.</p>
          )}
          <button type="button" className="tk-cancel" onClick={stayListening}>Changed your mind? <b>Stay listening</b></button>
        </div>
      )}

      {sheet && (
        <div className="tk-scrim" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="tk-sheet small">
            <div className="tk-grab" />
            {sheet === 'ask' ? (
              <>
                <h2>Ask to join {hostSp?.name || 'the host'}</h2>
                <p className="tk-sub">You keep listening until they say yes. You can cancel anytime.</p>
                {!anon && (
                  <div className="tk-opts">
                    <button type="button" className={'tk-opt' + (askMode === 'voice' ? ' on' : '')} onClick={() => setAskMode('voice')}>
                      <span className="tk-oi">🎙</span><b>Voice only</b><small>Just your voice. Nobody sees you.</small></button>
                    <button type="button" className={'tk-opt' + (askMode === 'camera' ? ' on' : '')} onClick={() => setAskMode('camera')}>
                      <span className="tk-oi">🎥</span><b>Voice + camera</b><small>Show your face. Turn it off anytime.</small></button>
                  </div>
                )}
                {anon && <p className="tk-mask">🎭 This room is voice only. You’ll go by your room name.</p>}
                {askMode === 'camera' && !anon && (
                  <div className="tk-prev">{preview ? <Cam stream={preview} mirror /> : <span className="tk-prevwait">Opening your camera…</span>}
                    <span className="tk-only">Only you see this</span></div>
                )}
                <input className="tk-field" maxLength={120} value={askNote} placeholder="Add a note for the host (optional)"
                       onChange={(e) => setAskNote(e.target.value)} />
                <button type="button" className="tk-go" onClick={ask}>Ask to join</button>
                <p className="tk-foot">You join muted · Nothing is recorded</p>
              </>
            ) : sheet === 'requests' ? (
              <>
                <h2>Asking to join {hands.length > 0 && <span className="tk-n">{hands.length}</span>}</h2>
                <p className="tk-sub">Nobody comes up until you say yes. They join muted.</p>
                <div className="tk-seg">
                  {[['everyone', 'Everyone'], ['friends', 'Friends'], ['off', 'Off']].map(([k, w]) => (
                    <button type="button" key={k} className={s.requests === k ? 'on' : ''} onClick={() => setWho(k)}>{w}</button>
                  ))}
                </div>
                {hands.length === 0 && <p className="tk-sub">{s.requests === 'off' ? 'Requests are off.' : 'Nobody’s asking right now.'}</p>}
                {hands.map((h) => (
                  <div className="tk-req" key={h.seat}>
                    <span className="tk-bigav sm" style={{ background: anon ? '#2A3D33' : tint(h.name) }}>{anon ? '🎭' : h.name.slice(0, 1).toUpperCase()}</span>
                    <span className="tk-rbd">
                      <span className="tk-rt"><b>{h.name}</b><span className={'tk-mode ' + h.mode}>{h.mode === 'camera' ? '🎥 Camera' : '🎙 Voice'}</span></span>
                      <small>{[dayLabel(h.day) && `🌱 ${dayLabel(h.day)}`, h.friend && 'your friend'].filter(Boolean).join(' · ')}</small>
                      {h.note && <span className="tk-rnote">“{h.note}”</span>}
                      <span className="tk-racts">
                        <button type="button" className="tk-yes" disabled={seatsOpen === 0} onClick={() => mod('talk_bring_up', h.seat, { p_camera: true })}>Bring up</button>
                        {h.mode === 'camera' && <button type="button" className="tk-alt" disabled={seatsOpen === 0} onClick={() => mod('talk_bring_up', h.seat, { p_camera: false })}>Voice only</button>}
                        <button type="button" className="tk-no" aria-label="Not now" onClick={() => mod('talk_decline', h.seat)}>✕</button>
                      </span>
                    </span>
                  </div>
                ))}
                <p className="tk-sub" style={{ marginTop: 10 }}>{seatsOpen === 0 ? 'All 4 seats are full. Move someone down first.' : `${seatsOpen} seat${seatsOpen === 1 ? '' : 's'} open`}</p>
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
                {!sheet.me && (
                  <button type="button" className="tk-act" onClick={() => reportSeat(sheet.seat)}>🚩 Report this person</button>
                )}
                {s.mod && !sheet.me && !sheet.host && (
                  <>
                    <p className="tk-fl">Host tools</p>
                    <button type="button" className="tk-act" onClick={() => mod('talk_host_mute', sheet.seat)}>🔇 Mute them</button>
                    {sheet.cam && <button type="button" className="tk-act" onClick={() => mod('talk_host_cam_off', sheet.seat)}>📷 Turn their camera off</button>}
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
