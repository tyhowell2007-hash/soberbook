import { base } from '../../lib/rm/server';

export default function NotFound() {
  return (
    <div className="page"><div className="empty">
      <h1>We couldn’t find that page</h1>
      <p className="small">The listing may have moved. Search again, or call the SAMHSA Helpline at 1-800-662-4357 for help finding care.</p>
      <a className="btn" href={`${base()}/search`}>Find care</a>
    </div></div>
  );
}
