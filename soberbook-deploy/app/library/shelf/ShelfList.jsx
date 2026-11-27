'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { byId } from '../books';
import { shelf, unsave } from '../shelf-store';

export default function ShelfList() {
  const [s, setS] = useState(null);
  useEffect(() => { setS(shelf()); }, []);
  if (!s) return null;
  const books = s.saved.map(byId).filter(Boolean);

  if (!books.length) return (
    <div className="lb-emptybox">
      <b>Your shelf is empty</b>
      <p>Tap “Save to My Shelf” on any book, or start reading one, and it’ll wait here.</p>
      <Link href="/library" className="lb-go">Browse the Library</Link>
    </div>
  );

  return (
    <ul className="lb-list">
      {books.map((b) => {
        const p = s.place[b.id];
        const href = b.kind === 'hosted' ? `/library/${b.id}/read` : `/library/${b.id}`;
        return (
          <li key={b.id} className="lb-shelfrow">
            <Link href={href} className="lb-book">
              <span className={'lb-cover' + (b.kind === 'linked' ? ' ln' : '')} aria-hidden="true">{b.title.slice(0, 1)}</span>
              <span className="lb-meta">
                <b>{b.title}</b>
                <span className="lb-sub">{p ? `Part ${p.ch + 1} · pick up where you left off` : b.kind === 'hosted' ? 'Not started' : `Free from ${b.from}`}</span>
              </span>
            </Link>
            <button type="button" className="lb-remove" aria-label={`Remove ${b.title} from My Shelf`}
                    onClick={() => { unsave(b.id); setS(shelf()); }}>Remove</button>
          </li>
        );
      })}
    </ul>
  );
}
