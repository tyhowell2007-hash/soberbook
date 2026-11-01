import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';

/* =====================================================================
   /api/talk/rtc — THE ONLY DOOR TO CLOUDFLARE REALTIME. 1 Nov 2026.

   Talk Rooms carries its sound on Cloudflare Realtime (the "Serverless
   SFU"). Sober Book owns the talk — the stage, hands, chat, coins, who is
   removed — and Cloudflare only moves audio between browsers.

   🔴 CF_RTC_APP_TOKEN never leaves this file. No NEXT_PUBLIC_ prefix, so
   Next.js will not ship it to a browser. A browser asks here; this route
   asks the database (talk_my_media, as the signed-in member) whether that
   member may, and only then speaks to Cloudflare.

   What a caller may do:
     session      make their own Cloudflare session (any live participant)
     publish      send their mic           — speakers only, own session only
     pull         hear the speakers        — own session; every track asked
                                             for must belong to a CURRENT
                                             speaker of THIS talk
     renegotiate  finish a pull            — own session only
     close        stop tracks              — own session only

   ⚠️ A session id is only ever accepted if it is the one the database has
   recorded for THIS caller in THIS talk. Knowing somebody else's session
   id (every listener can see speakers' ids — they need them to pull) lets
   you hear them, never act as them.
   ===================================================================== */

export const dynamic = 'force-dynamic';

const API = 'https://rtc.live.cloudflare.com/v1/apps/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESS = /^[A-Za-z0-9_-]{8,128}$/;
const TRACK = /^[A-Za-z0-9_-]{1,64}$/;

const j = (body, status = 200) => NextResponse.json(body, { status });

export async function POST(request) {
  const appId = process.env.CF_RTC_APP_ID;
  const token = process.env.CF_RTC_APP_TOKEN;
  if (!appId || !token) return j({ error: 'Live talk isn’t set up yet.' }, 503);

  let b;
  try { b = await request.json(); } catch { return j({ error: 'Bad request.' }, 400); }
  const { talk, action } = b || {};
  if (typeof talk !== 'string' || !UUID.test(talk)) return j({ error: 'Bad request.' }, 400);

  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return j({ error: 'Sign in first.' }, 401);

  const { data: me, error } = await supabase.rpc('talk_my_media', { p_talk: talk });
  if (error || !me?.live) return j({ error: 'This talk has ended.' }, 403);

  const base = `${API}${appId.trim()}/sessions`;
  const headers = { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' };
  const cf = async (path, method, body) => {
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.errorCode) {
      console.error('talk rtc', action, r.status, d.errorCode, d.errorDescription);
      throw new Error('cf');
    }
    return d;
  };

  try {
    if (action === 'session') {
      const d = await cf('/new', 'POST');
      if (!SESS.test(d.sessionId || '')) return j({ error: 'Couldn’t connect.' }, 502);
      const { error: e2 } = await supabase.rpc('talk_set_media', { p_talk: talk, p_session: d.sessionId, p_track: null });
      if (e2) return j({ error: 'Couldn’t connect.' }, 502);
      return j({ sessionId: d.sessionId });
    }

    // everything else acts on the caller's own recorded session
    if (!me.session || b.session !== me.session) return j({ error: 'Not your connection.' }, 403);
    const s = `/${me.session}`;

    if (action === 'publish') {
      if (me.role !== 'speaker') return j({ error: 'You’re listening. Raise your hand to talk.' }, 403);
      if (typeof b.sdp !== 'string' || b.sdp.length > 20000 || !b.mid || !TRACK.test(b.trackName || '')) {
        return j({ error: 'Bad request.' }, 400);
      }
      /* ⚠️ A fresh track name every time somebody comes on stage. Cloudflare
         can keep a closed track's record in the session, so stepping down
         and coming back up as 'mic' again could collide. */
      const d = await cf(`${s}/tracks/new`, 'POST', {
        sessionDescription: { type: 'offer', sdp: b.sdp },
        tracks: [{ location: 'local', mid: String(b.mid), trackName: b.trackName }],
      });
      await supabase.rpc('talk_set_media', { p_talk: talk, p_session: null, p_track: b.trackName });
      return j({ sessionDescription: d.sessionDescription, tracks: d.tracks });
    }

    if (action === 'pull') {
      const allowed = new Set(me.speakers || []);
      const want = Array.isArray(b.tracks) ? b.tracks.slice(0, 4) : [];
      if (!want.length) return j({ error: 'Bad request.' }, 400);
      for (const t of want) {
        if (!SESS.test(t?.sessionId || '') || !TRACK.test(t?.trackName || '') || !allowed.has(t.sessionId) || t.sessionId === me.session) {
          return j({ error: 'They’re not on stage any more.' }, 409);
        }
      }
      const d = await cf(`${s}/tracks/new`, 'POST', {
        tracks: want.map((t) => ({ location: 'remote', sessionId: t.sessionId, trackName: t.trackName })),
      });
      return j({
        sessionDescription: d.sessionDescription || null,
        requiresImmediateRenegotiation: !!d.requiresImmediateRenegotiation,
        tracks: d.tracks || [],
      });
    }

    if (action === 'renegotiate') {
      if (typeof b.sdp !== 'string' || b.sdp.length > 20000) return j({ error: 'Bad request.' }, 400);
      await cf(`${s}/renegotiate`, 'PUT', { sessionDescription: { type: 'answer', sdp: b.sdp } });
      return j({ ok: true });
    }

    if (action === 'close') {
      const mids = Array.isArray(b.mids) ? b.mids.slice(0, 8).map(String) : [];
      if (!mids.length) return j({ ok: true });
      await cf(`${s}/tracks/close`, 'PUT', { tracks: mids.map((mid) => ({ mid })), force: true });
      if (b.unpublish) await supabase.rpc('talk_set_media', { p_talk: talk, p_session: null, p_track: null });
      return j({ ok: true });
    }

    return j({ error: 'Bad request.' }, 400);
  } catch {
    return j({ error: 'The sound connection dropped. Try again.' }, 502);
  }
}
