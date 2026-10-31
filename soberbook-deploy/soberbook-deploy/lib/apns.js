import http2 from 'node:http2';
import crypto from 'node:crypto';

/* =====================================================================
   SENDING TO THE iPHONE APP THROUGH APPLE (APNs).  31 Oct 2026.

   The TestFlight / App Store app shows soberbook.app inside a native
   shell, and Apple switches website alerts off in there. So the app gets
   a real Apple device token, saves it in push_subscriptions as
   endpoint 'apns:<token>', and this file delivers to it.

   Four Vercel environment variables, all set by Ty by hand (never typed
   by Claude — the key is a secret):
     APNS_KEY     the whole AuthKey_XXXXXXXXXX.p8 file, pasted as is
     APNS_KEY_ID  the 10-character Key ID next to the key on Apple's site
     APNS_TEAM_ID 37F7J2943U  (Sober Book LLC's team)
     APNS_TOPIC   optional, defaults to app.soberbook
   Missing any of the first three → iPhone devices are simply skipped,
   never counted as failures, so nobody loses their row while it's unset.

   ⚠️ TestFlight and App Store builds use Apple's PRODUCTION server. A
   build run straight from Xcode uses the SANDBOX one, and production
   answers its tokens with BadDeviceToken — so that one answer is retried
   against the sandbox before the token is called dead.
   ===================================================================== */

const PROD = 'https://api.push.apple.com';
const SANDBOX = 'https://api.sandbox.push.apple.com';

export function apnsConfigured() {
  return !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

/* The .p8 file pasted into Vercel can arrive three ways: with real line
   breaks, with literal "\n", or squashed onto one line. Rebuild a proper
   PEM from whatever came. */
function pem() {
  const raw = String(process.env.APNS_KEY || '').replace(/\\n/g, '\n');
  const body = raw.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
}

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/* Apple wants a fresh signed token at least every hour and refuses one
   refreshed more than every 20 minutes. 40 minutes sits between. */
let cached = { jwt: '', at: 0 };
function bearer() {
  if (cached.jwt && Date.now() - cached.at < 40 * 60 * 1000) return cached.jwt;
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }));
  const claims = b64u(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key: pem(), dsaEncoding: 'ieee-p1363' });
  cached = { jwt: `${head}.${claims}.${b64u(sig)}`, at: Date.now() };
  return cached.jwt;
}

function post(session, token, body, headers) {
  return new Promise((resolve) => {
    let data = '';
    const req = session.request({ ':method': 'POST', ':path': `/3/device/${token}`, ...headers });
    req.setEncoding('utf8');
    req.on('response', (h) => { req._status = h[':status']; });
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      let reason = '';
      try { reason = JSON.parse(data || '{}').reason || ''; } catch { /* empty body on success */ }
      resolve({ status: req._status || 0, reason });
    });
    req.on('error', (e) => resolve({ status: 0, reason: e?.code || 'error' }));
    req.setTimeout(8000, () => { req.close(); resolve({ status: 0, reason: 'timeout' }); });
    req.end(JSON.stringify(body));
  });
}

async function batch(host, tokens, body, headers) {
  const session = http2.connect(host);
  session.on('error', () => {});
  try {
    return await Promise.all(tokens.map((t) => post(session, t, body, headers)));
  } finally {
    session.close();
  }
}

/**
 * Send one alert to several iPhone tokens.
 * @returns {Array<{token:string, ok:boolean, dead:boolean}>}
 */
export async function sendApns(tokens, { title, body, to, urgent }) {
  if (!tokens.length || !apnsConfigured()) return [];
  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      /* Same idea as the website's single tag: the everyday alerts stack
         into one thread rather than eleven separate buzzes. */
      'thread-id': urgent ? 'soberbook-urgent' : 'soberbook',
    },
    to,
  };
  const headers = {
    authorization: `bearer ${bearer()}`,
    'apns-topic': process.env.APNS_TOPIC || 'app.soberbook',
    'apns-push-type': 'alert',
    'apns-priority': '10',
    /* ⚠️ An urgent report gets NO collapse id, so it can never quietly
       replace another alert. Everything else replaces the last one. */
    ...(urgent ? {} : { 'apns-collapse-id': 'soberbook' }),
  };

  const first = await batch(PROD, tokens, payload, headers);
  const out = first.map((r, i) => ({ token: tokens[i], ...r }));

  const retry = out.filter((r) => r.status === 400 && r.reason === 'BadDeviceToken');
  if (retry.length) {
    const second = await batch(SANDBOX, retry.map((r) => r.token), payload, headers);
    second.forEach((r, i) => Object.assign(retry[i], r));
  }

  return out.map((r) => ({
    token: r.token,
    ok: r.status === 200,
    /* 410 = app deleted / alerts turned off. BadDeviceToken after both
       servers = never going to work. Anything else is counted, not killed. */
    dead: r.status === 410 || r.reason === 'Unregistered' || r.reason === 'BadDeviceToken',
    /* 403 = OUR key is wrong or missing (InvalidProviderToken). Tested
       31 Oct: a fake key gets exactly this. That is never the member's
       phone's fault, so it must not count toward retiring their device. */
    ours: r.status === 403,
  }));
}
