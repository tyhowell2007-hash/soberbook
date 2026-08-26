/* =====================================================================
   THE SERVICE WORKER — and it caches almost nothing, on purpose.

   ---------------------------------------------------------------------
   🔴 WHY THIS FILE IS SO CAUTIOUS

   A service worker sits between the app and the network and can keep
   copies of responses on the device. Every "make your site work
   offline" tutorial caches pages. For Sober Book that is dangerous, and
   the reason is worth stating plainly:

   Phones get shared. A partner, a sibling, a kid, someone at a meeting
   who wants to look something up. If this worker cached /wall or /me or
   a chat thread, that page would still be on the device after sign-out
   — and could be served to whoever opens the app next, with no session
   and no check, because a cache hit never reaches the server.

   That's not a theoretical bug. It's somebody's anonymous post, or the
   name of the person they're messaging, handed to the next person
   holding the phone.

   ⭐ So the rule here is the same one the storage buckets follow: the
   safest cache is the one that cannot contain anything private.

   WHAT IS CACHED:  /_next/static/*  — Next.js build assets. Hashed
                    filenames, no session, identical for every member.
                    The icons and the offline page.

   WHAT IS NEVER CACHED:  every HTML page, every /api response, and
                    anything cross-origin (which is where signed photo
                    and video links live).

   ⚠️ If you ever add caching here, the question to answer first is not
   "is this faster" but "would I be happy for the next person to pick up
   this phone and see it".

   ---------------------------------------------------------------------
   WHY IT EXISTS AT ALL, THEN

   Two reasons, neither of which needs private data:

   1. Chrome will not offer "install" without a service worker that has
      a fetch handler. No worker, no home-screen prompt on Android.
   2. When the phone has no signal, a person gets a page that explains
      that instead of the browser's dinosaur. In this app that matters:
      opening it at 2am and getting a broken-looking error reads as
      "even this doesn't want me".
   ===================================================================== */

const VERSION    = 'sb-v1';
const STATIC     = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';

/* Warm the offline page up front so it's there when the signal isn't. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([
      OFFLINE_URL,
      '/icon-192.png',
      '/icon-512.png',
    ])).then(() => self.skipWaiting())
  );
});

/* Drop caches from older versions. Without this, a stale build's assets
   linger forever and a bad deploy can't be fully undone by shipping a
   good one. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Only GET. A POST is somebody saying something — it must reach the
     server or fail loudly, never be quietly answered from a cache. */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Cross-origin: Supabase, signed media links, fonts. Left completely
     alone. Signed URLs expire, and a cached one would either be dead or
     — worse — still alive on a device it shouldn't be. */
  if (url.origin !== self.location.origin) return;

  /* 🔴 Never touch the API. Every one of these is session-shaped. */
  if (url.pathname.startsWith('/api/')) return;

  /* ---- pages ----------------------------------------------------- *
     Network only. If the network is gone, show the offline page.
     ⚠️ NOTHING IS WRITTEN TO THE CACHE HERE. Not the wall, not a
     profile, not a chat. See the note at the top. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  /* ---- build assets ---------------------------------------------- *
     Hashed filenames under /_next/static are immutable — the name
     changes when the content does — so a cache hit can never be stale.
     Cache-first is safe and makes a second launch feel instant. */
  const cacheable = url.pathname.startsWith('/_next/static/')
    || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);

  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      /* Only store a clean 200 from our own origin. An opaque or error
         response cached here would be served back forever. */
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});

/* =====================================================================
   A BUZZ IN YOUR POCKET  (0073).

   Ty, Aug 25: "if a user on soberbook gets notification can we make it so
   your phone gets a notification?"

   ---------------------------------------------------------------------
   🔴 EVERYTHING THIS SHOWS IS A CONSTANT. NOTHING COMES OFF THE WIRE.

   The payload the server sends is a single uuid and a destination path.
   There is no name in it, no words from the post, and not even which kind
   of thing happened — so there is nothing here that COULD leak, however
   this file is edited later.

   Why: a notification lands on a LOCK SCREEN. Face up on a break-room
   table, in front of a partner who doesn't know, on a phone a parole
   officer or a parent can see. "Jacobycurry96 replied to your post: man
   that hit home, I was four months in when—" is this app outing somebody
   who came here specifically so they would never have to explain
   themselves. That is the day-count-badge risk from
   `[C] Building for Women.md` with a vibration attached.

   Ty was shown both versions and chose this one.

   ⚠️ IF SOMEBODY LATER "IMPROVES" THIS BY PUTTING THE HANDLE IN THE BODY,
   they will have to add it to the server payload too — which is the
   second lock. Both were built that way on purpose.
   ===================================================================== */

self.addEventListener('push', (event) => {
  /* ⚠️ A push with no data at all is legal and does happen — some
     services wake a worker with an empty body. Falling over here would
     mean a silent dead notification, so it degrades to the same text. */
  let to = '/wall';
  try {
    const d = event.data ? event.data.json() : {};
    /* Only a path is accepted, and only one that starts with a single
       slash. ⚠️ Without this check a payload could carry
       "https://somewhere-else" and the notification would become a link
       out of the app — a phishing surface aimed at people in recovery. */
    if (typeof d.to === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(d.to)) to = d.to;
  } catch { /* keep the default */ }

  event.waitUntil(
    self.registration.showNotification('Sober Book', {
      body: 'Somebody answered you.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      /* ⚠️ One tag, so a second notification REPLACES the first rather
         than stacking. Waking up to eleven separate buzzes from a
         conversation that happened while you slept is the thing every
         other app does and the thing this one shouldn't. */
      tag: 'soberbook',
      renotify: false,
      data: { to },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const to = (event.notification.data && event.notification.data.to) || '/wall';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    /* If the app is already open somewhere, go to that window rather than
       opening a second copy. */
    for (const c of all) {
      if (c.url.includes(self.location.origin)) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(to); } catch {} }
        return;
      }
    }
    await self.clients.openWindow(to);
  })());
});
