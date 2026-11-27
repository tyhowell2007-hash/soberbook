import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOOKS, byId } from '../books';
import SaveButton from '../SaveButton';

/* /library/<id> — one book. Hosted books: Start reading. Linked books:
   open the publisher's own free page, labelled with who it's from, with
   no-referrer like every outbound link here (the referrer would tell a
   stranger's logs that the visitor is in recovery). */
export function generateStaticParams() { return BOOKS.map((b) => ({ id: b.id })); }

export function generateMetadata({ params }) {
  const b = byId(params.id);
  return { title: b ? `${b.title} · The Library` : 'The Library' };
}

export default function BookPage({ params }) {
  const b = byId(params.id);
  if (!b) notFound();
  return (
    <>
      <div className="mast">
        <Link href="/library" className="back" aria-label="Back to the Library">←</Link>
        <span className="lg">the library</span>
      </div>
      <div className="pad lb-pad">
        <div className="lb-top">
          <span className={'lb-bigcover' + (b.kind === 'linked' ? ' ln' : '')} aria-hidden="true">{b.title.slice(0, 1)}</span>
          <div>
            <h1 className="lb-title">{b.title}</h1>
            <p className="lb-sub">{b.author}{b.extra ? ` · ${b.extra}` : ''}</p>
            <span className="lb-tag">{b.kind === 'hosted' ? 'Read in Sober Book' : `Free from ${b.from}`}</span>
          </div>
        </div>
        <p className="lb-note"><b>Librarian’s note:</b> {b.note}</p>
        {b.size && <p className="lb-small">{b.size} · public domain</p>}
        {b.kind === 'hosted' ? (
          <Link href={`/library/${b.id}/read`} className="lb-go">Start reading</Link>
        ) : (
          <a href={b.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="lb-go">
            Open from {b.from} ↗
          </a>
        )}
        <SaveButton id={b.id} />
        <p className="lb-small lb-center">
          {b.kind === 'hosted'
            ? <>From <a href={b.fromUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{b.from}</a>. Free to read and share.</>
            : <>Opens {b.from}’s own free page. Sober Book doesn’t see what you read there.</>}
        </p>
      </div>
    </>
  );
}
