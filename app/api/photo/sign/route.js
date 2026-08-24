import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import { signPhotoPaths } from '../../../../lib/sign-photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   THE SIGNING ROUTE — who is allowed to LOOK at a photo.

   The buckets are private, so an object has no working URL of its own.
   To show one we mint a temporary signed link. Which means this answers
   the only question that matters: may this person see this picture?

   ---------------------------------------------------------------------
   ⭐ THE ONE IDEA IN HERE

   It does not decide. It ASKS THE VIEWS THAT ALREADY DECIDED.

   The obvious way to write this is a list of checks: is the poster
   blocked, is the post anonymous, is the account suspended, is the
   profile in anonymous mode, did the member choose the photo option. Six
   or seven conditions, reimplemented here in JavaScript.

   That version is wrong the day somebody adds an eighth rule, updates
   `feed_posts`, and never opens this file. The two would disagree, and
   the one that leaks is the one nobody was looking at. Every rule would
   have two homes and would eventually contradict itself.

   Instead, signPhotoPaths() queries `feed_posts` and `public_profiles`
   AS THE MEMBER. Those views already null a photo on an anonymous post,
   already hide blocked people in both directions, already drop suspended
   accounts. If the member cannot see the post, the query returns nothing
   and the path is never signed.

   So there are no security rules in this file. It inherits them. Add a
   rule to the view tomorrow and this obeys it untouched.

   ---------------------------------------------------------------------
   ⚠️ THE PART THAT WOULD BE EASY TO GET WRONG

   It would be simpler to sign whatever the caller sends — the paths are
   random UUIDs, so who could guess one?

   Nobody would have to guess. They would already have them: from posts
   they could see before being blocked, or from a profile that has since
   gone anonymous. "Unguessable" is not "unauthorised", and a blocked
   person quietly keeping access to the photos of the person who blocked
   them is exactly the failure this app cannot have.
   ===================================================================== */

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((p) => typeof p === 'string')
    : [];

  /* A path the member may not see is simply ABSENT from the reply. No
     error, no "forbidden", no count of how many were refused — each of
     those confirms that a photo exists, which is itself a fact worth not
     leaking. The picture just isn't there. */
  return NextResponse.json({ urls: await signPhotoPaths(supabase, paths) });
}
