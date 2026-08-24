import { redirect } from 'next/navigation';
import { serverClient, assertReadable } from '../../lib/supabase-server';
import Wall from './Wall';

export const dynamic = 'force-dynamic';

/* =====================================================================
   QUIET.

   Ty, Aug 21: "spirituality, church or religion and meditation
   practices... see what kind of spin we can put on them."

   Three pieces, one page:
     1. what gets you through  — the wall nobody can answer back on
     2. practices              — sorted by how bad it is right now
     3. the room               — already built, a member opens one

   ⭐ Piece 1 is the reason this page exists. Everybody writes what gets
   them through — their daughter, Jesus, the ocean, the group, nothing —
   and NOBODY CAN REPLY. In an app that is otherwise entirely about
   being answered, this is the one wall you cannot be corrected on.

   What drives people out of the rooms isn't God. It's the implication
   that there's a right answer about God and that theirs is wrong. Two
   hundred different answers sitting next to each other, none of them
   under attack, kills that implication better than any argument.
   ===================================================================== */
export default async function QuietPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* RULE 1: the view, never the table. Here it is doing the single most
     important job on the page — higher_powers.author_id is populated on
     every row including the anonymous ones, and the view is what nulls
     it. Read the table and every "Anonymous Cedar" on this page comes
     back with a name attached. assertReadable() says so at the call
     site, and the database revokes SELECT on the table so it isn't
     merely a convention. */
  const { data: rows, error } = await supabase
    .from(assertReadable('what_gets_you_through'))
    .select('id, body, is_anonymous, author_id, is_mine, display_name, display_avatar, handle, author_days, shuffle')
    /* ⭐ The shuffle column, not created_at. Newest-first would make
       this a feed and hand permanent top billing to whoever wrote last.
       The sort key is stable all day and different tomorrow, so nobody's
       answer is ever permanently at the top — which is the page's whole
       argument, expressed as an ORDER BY. */
    .order('shuffle', { ascending: true })
    .limit(500);

  const answers = rows || [];
  const mine = answers.find((a) => a.is_mine) || null;

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <span className="rt">quiet</span>
      </div>
      <div className="bar">Nobody here has to agree</div>
      {error
        ? <div className="pad"><div className="err">Couldn&apos;t load this: {error.message}</div></div>
        : <Wall answers={answers} mine={mine} />}
    </>
  );
}
