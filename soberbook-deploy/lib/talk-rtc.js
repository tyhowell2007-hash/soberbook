'use client';

/* =====================================================================
   THE SOUND LINE FOR A TALK. 1 Nov 2026.

   One RTCPeerConnection per member, to Cloudflare Realtime, by way of
   /api/talk/rtc (which holds the app token and checks every request
   against the database). Speakers SEND their mic on it; everybody PULLS
   the speakers off it.

   ⚠️ EVERY NEGOTIATION GOES THROUGH ONE QUEUE. Publishing and pulling
   both rewrite the same connection's SDP; two at once leaves it in
   have-local-offer and silences the room. `q()` runs them one at a time.

   ⭐ TALKING LIGHTS COME FROM getSynchronizationSources(), NOT AN
   AudioContext. Piping a WebRTC stream into Web Audio has muted the
   <audio> element on some iPhones; reading the receiver's own level
   touches nothing that plays.
   ===================================================================== */

const STUN = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export class TalkLine {
  constructor(talkId, { onRemote, onGone, onError } = {}) {
    this.talkId = talkId;
    this.onRemote = onRemote || (() => {});
    this.onGone = onGone || (() => {});
    this.onError = onError || (() => {});
    this.pc = null;
    this.session = null;
    this.chain = Promise.resolve();
    this.pulled = new Map();   // key -> mid
    this.midKey = new Map();   // mid -> key
    this.mic = null;           // { stream, track, tx }
    this.closed = false;
  }

  q(fn) {
    const run = this.chain.then(() => (this.closed ? null : fn()));
    this.chain = run.catch(() => {});
    return run;
  }

  async api(action, extra = {}) {
    const r = await fetch('/api/talk/rtc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talk: this.talkId, action, session: this.session, ...extra }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(d.error || 'The sound connection dropped.');
      e.status = r.status;
      throw e;
    }
    return d;
  }

  async start() {
    this.pc = new RTCPeerConnection({ iceServers: STUN, bundlePolicy: 'max-bundle' });
    this.pc.ontrack = (e) => {
      const mid = e.transceiver?.mid;
      const key = mid != null ? this.midKey.get(String(mid)) : null;
      if (!key) return;
      const stream = e.streams?.[0] || new MediaStream([e.track]);
      this.onRemote(key, stream, e.receiver);
    };
    const d = await this.api('session');
    this.session = d.sessionId;
  }

  /* ---------- speaking ---------- */

  get publishing() { return !!this.mic; }

  publish() {
    return this.q(async () => {
      if (this.mic) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const track = stream.getAudioTracks()[0];
      track.enabled = false; // everyone comes up muted
      const tx = this.pc.addTransceiver(track, { direction: 'sendonly' });
      await this.pc.setLocalDescription(await this.pc.createOffer());
      try {
        const trackName = 'mic-' + Math.random().toString(36).slice(2, 10);
        const r = await this.api('publish', { sdp: this.pc.localDescription.sdp, mid: tx.mid, trackName });
        await this.pc.setRemoteDescription(r.sessionDescription);
        this.mic = { stream, track, tx };
      } catch (e) {
        track.stop();
        try { tx.stop(); } catch {}
        throw e;
      }
    });
  }

  setMic(on) {
    if (this.mic) this.mic.track.enabled = !!on;
  }

  unpublish() {
    return this.q(async () => {
      if (!this.mic) return;
      const { track, tx } = this.mic;
      this.mic = null;
      track.stop();
      const mid = tx.mid;
      try { tx.stop(); } catch {}
      if (mid != null) await this.api('close', { mids: [mid], unpublish: true }).catch(() => {});
    });
  }

  /* ---------- listening ---------- */

  // speakers: [{ session, track }] for everybody on stage but me
  sync(speakers) {
    return this.q(async () => {
      const want = new Map();
      for (const s of speakers) {
        if (s.session && s.track && s.session !== this.session) want.set(`${s.session}:${s.track}`, s);
      }

      const gone = [...this.pulled.keys()].filter((k) => !want.has(k));
      if (gone.length) {
        const mids = gone.map((k) => this.pulled.get(k));
        for (const k of gone) {
          const mid = this.pulled.get(k);
          this.pulled.delete(k);
          this.midKey.delete(String(mid));
          this.onGone(k);
          const tx = this.pc.getTransceivers().find((t) => t.mid === String(mid));
          try { tx?.stop(); } catch {}
        }
        await this.api('close', { mids }).catch(() => {});
      }

      const fresh = [...want.entries()].filter(([k]) => !this.pulled.has(k));
      if (!fresh.length) return;
      const r = await this.api('pull', {
        tracks: fresh.map(([, s]) => ({ sessionId: s.session, trackName: s.track })),
      });
      for (const t of r.tracks || []) {
        if (t.errorCode || t.mid == null) continue; // not ready yet — next sync tries again
        const k = `${t.sessionId}:${t.trackName}`;
        this.pulled.set(k, String(t.mid));
        this.midKey.set(String(t.mid), k);
      }
      if (r.requiresImmediateRenegotiation && r.sessionDescription) {
        await this.pc.setRemoteDescription(r.sessionDescription);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.api('renegotiate', { sdp: answer.sdp });
      }
    });
  }

  /* ---------- talking lights ---------- */

  // returns { key: level 0..1 } for everybody I'm hearing, plus 'me'
  async levels() {
    const out = {};
    if (!this.pc) return out;
    for (const tx of this.pc.getTransceivers()) {
      const k = tx.mid != null ? this.midKey.get(String(tx.mid)) : null;
      if (!k || !tx.receiver?.getSynchronizationSources) continue;
      const src = tx.receiver.getSynchronizationSources();
      out[k] = src.reduce((m, s) => Math.max(m, s.audioLevel || 0), 0);
    }
    if (this.mic?.track.enabled) {
      try {
        const stats = await this.mic.tx.sender.getStats();
        stats.forEach((s) => { if (s.type === 'media-source' && s.kind === 'audio') out.me = s.audioLevel || 0; });
      } catch {}
    }
    return out;
  }

  close() {
    this.closed = true;
    try { this.mic?.track.stop(); } catch {}
    try { this.pc?.close(); } catch {}
    this.mic = null;
    this.pc = null;
  }
}
