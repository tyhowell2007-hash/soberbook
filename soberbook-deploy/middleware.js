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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
