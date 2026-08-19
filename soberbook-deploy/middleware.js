import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Refreshes the Supabase session on every request and keeps unauthenticated
// users out of the app. Login and the auth callback stay open.
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  /* ⚠️ /reset MUST BE OPEN, AND THIS IS NOT A CONVENIENCE — WITHOUT IT
     PASSWORD RESET CANNOT WORK AT ALL.

     Supabase puts the recovery token in the URL **fragment**
     (#access_token=…). A fragment is never sent to the server, so this
     middleware sees a person with no session and bounces them to
     /login — and the redirect throws the fragment away. The token is
     gone, the link is spent, and the person is back where they started
     with no idea why.

     The exchange has to happen in the browser, which means the page has
     to be allowed to load first. It is safe: arriving at /reset with no
     valid token gets you a form that can't do anything, because
     updateUser needs a session the token is the only way to obtain. */
  const open = ['/login', '/auth', '/reset'];
  const isOpen = open.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isOpen) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

/* ⚠️ THE THREE INSTALL FILES HAVE TO BE PUBLIC, AND THEY WEREN'T.
   ---------------------------------------------------------------------
   Found the moment soberbook.app went live, Aug 18. The matcher already
   let images through, but not `manifest.webmanifest`, `sw.js` or
   `offline.html` — so a signed-OUT visitor asking for any of them got
   bounced to /login and received an HTML page where a manifest should
   be.

   That means a stranger could not install the app. At all. The browser
   needs the manifest and the service worker to offer "Add to Home
   Screen", and it could reach neither until you had an account.

   🔴 It was invisible on soberbook.vercel.app for a month because Ty
   was permanently signed in there — the files loaded fine for the one
   person who never needed them to. The new domain had no session
   cookie, which is the first time anything asked for these files as a
   stranger would. **A new domain is an accidental logged-out test of
   your entire app.**

   Safe to open: the manifest is a name, some colours and icon paths;
   sw.js is our own code with no secrets in it; offline.html is a static
   page. Nothing here reads a session or touches the database. */
/* 🔴 ONE UNBROKEN STRING. DO NOT SPLIT IT ACROSS LINES WITH `+`.
   ---------------------------------------------------------------------
   I wrote this as three concatenated strings the first time, purely so
   it would fit on a screen. It deployed, the build went green, and the
   fix did nothing.

   Next.js reads `matcher` by STATIC ANALYSIS at build time — it looks at
   the literal in the source, it does not run the file. `'a' + 'b'` is an
   expression, not a literal, so the config was unreadable and the
   middleware fell back to guarding everything, exactly as before.

   ⚠️ Nothing warned about this. No build error, no console message. The
   deployment was "Ready" and the behaviour was unchanged, which is the
   worst combination — it looks like your change was wrong when in fact
   your change was never read.

   ⭐ Same family as the two `app/` folders and the dropped `lib` folder:
   a silent no-op that reports success. When a change appears to have no
   effect, check whether it was READ before assuming it was wrong. */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico)$).*)'],
};
