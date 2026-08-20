import Link from 'next/link';
import { serverClient } from '../../../../lib/supabase-server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/* ⚠️ NO DAY COUNTS IN THIS LIST, and the database function doesn't even
   return them. Scrolling somebody's followers next to how new each one
   is would be the newcomer-finder in list form — the same shape that was
   refused for presence dots on Aug 16. A day count belongs on a profile
   you opened on purpose, not in a list you can skim. */
export default async function Page({ params }) {
  const handle = decodeURIComponent(params.handle);
  const supabase = serverClient();

  const { data: who } = await supabase
    .from('public_profiles').select('handle, display_name')
    .eq('handle_key', handle.toLowerCase()).maybeSingle();
  /* Same silence as the profile page: no such handle, suspended, or a
     block in either direction all land here identically. */
  if (!who) notFound();

  const { data: rows } = await supabase.rpc('following_of', { h: handle });
  const list = rows || [];

  return (
    <>
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span>
        <Link href={`/u/${who.handle}`} className="back">←</Link></div>
      <div className="bar">FOLLOWING</div>
      <div className="pad">
        <p className="hint" style={{ marginTop: 0 }}>
          {who.display_name} is following
        </p>
        {list.length === 0 ? (
          <div className="empty">
            <div className="h">Nobody yet.</div>
            <div className="p">Find someone through the search.</div>
          </div>
        ) : (
          <ul className="findlist">
            {list.map((r) => (
              <li key={r.handle}>
                <Link href={`/u/${r.handle}`} className="findrow">
                  <span className="fav" aria-hidden="true">{r.display_avatar || '🌱'}</span>
                  <span className="fmeta">
                    <span className="fname">{r.display_name}</span>
                    <span className="fhandle">@{r.handle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
