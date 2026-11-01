import '../../share/share.css';
import { db } from '../../../lib/rm/server';
import { cardUrl, cardLabel, qrSvg, dayLine } from '../../../lib/share-card';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE PUBLIC CARD — soberbook.app/@handle (rewritten here by middleware).
   1 Nov 2026 (0199). Open to people who aren't on Sober Book.

   🔴 Shows only what share_card() returns: @handle, name (not in
   anonymous mode), emoji face, day count (only if the member allows it).
   🔴 A card that is turned off and a handle that doesn't exist draw the
   SAME page, so this address can't be used to check who is a member.
   ===================================================================== */
async function load(handle) {
  const h = decodeURIComponent(handle || '').replace(/^@/, '').slice(0, 40);
  if (!/^[A-Za-z0-9_.]{1,40}$/.test(h)) return null;
  const { data } = await db().rpc('share_card', { p_handle: h });
  return data || null;
}

export async function generateMetadata({ params }) {
  const c = await load(params.handle);
  if (!c) return { title: 'Sober Book', robots: { index: false } };
  const n = c.name || '@' + c.handle;
  return { title: `${n} on Sober Book`, description: 'A recovery community where you never have to explain yourself.',
           robots: { index: false, follow: false } };
}

export default async function Card({ params }) {
  const c = await load(params.handle);
  if (!c) {
    return (
      <div className="shc">
        <div className="off">
          <b>This card isn’t shared right now.</b>
          <p>Sober Book is a recovery community where you never have to explain yourself.</p>
        </div>
        <a className="join" href="/login">Join Sober Book</a>
      </div>
    );
  }
  const svg = await qrSvg(cardUrl(c.handle));
  const day = dayLine(c.days);
  return (
    <div className="shc">
      <div className="pcard">
        <span className="big">{c.avatar || (c.name || c.handle).slice(0, 1).toUpperCase()}</span>
        <span className="pname">{c.name || '@' + c.handle}</span>
        {c.name && <span className="phandle">@{c.handle}</span>}
        {day && <span className="pday">🌱 {day}</span>}
        <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="purl">{cardLabel(c.handle)}</span>
      </div>
      <a className="join" href={`/u/${c.handle}`}>Open in Sober Book</a>
      <a className="join ghost" href="/login">New here? Join Sober Book</a>
      <p className="fine">Sober Book is a recovery community. Posts stay inside the app. You only see what {c.name || '@' + c.handle} chose to share.</p>
    </div>
  );
}
