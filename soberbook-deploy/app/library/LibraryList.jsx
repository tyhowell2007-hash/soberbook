'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BOOKS, SHELVES, byId } from './books';
import { shelf } from './shelf-store';
import { track } from '../../lib/track';

/* The Library's list, with search and "pick up where you left off".
   The resume card is Kenny's ask: the one tool he wants everybody to
   know about, offered quietly at the bottom of the reading room. */
export default function LibraryList() {
  const [q, setQ] = useState('');
  const [last, setLast] = useState(null);

  useEffect(() => {
    track('library.open');
    const s = shelf();
    const recent = Object.entries(s.place).sort((a, b) => b[1].at - a[1].at)[0];
    if (recent && byId(recent[0])) setLast({ book: byId(recent[0]), ch: recent[1].ch });
  }, []);

  const term = q.trim().toLowerCase();
  const match = (b) => !term || (b.title + ' ' + b.author + ' ' + b.note).toLowerCase().includes(term);

  return (
    <>
      <label htmlFor="lb-q" className="sr-only">Search the Library</label>
      <input id="lb-q" className="lb-search" type="search" placeholder="Search books and guides"
             value={q} onChange={(e) => setQ(e.target.value)} />

      {!term && last && (
        <Link href={`/library/${last.book.id}/read`} className="lb-resume">
          <span className="lb-k">Pick up where you left off</span>
          <b>{last.book.title}</b>
        </Link>
      )}

      {SHELVES.map((sh) => {
        const items = BOOKS.filter((b) => b.shelf === sh.id && match(b));
        if (!items.length) return null;
        return (
          <section key={sh.id} className="lb-shelf" aria-labelledby={`lb-${sh.id}`}>
            <h2 id={`lb-${sh.id}`} className="lb-h">{sh.title}</h2>
            <ul className="lb-list">
              {items.map((b) => (
                <li key={b.id}>
                  <Link href={`/library/${b.id}`} className="lb-book">
                    <span className={'lb-cover' + (b.kind === 'linked' ? ' ln' : '')} aria-hidden="true">{b.title.slice(0, 1)}</span>
                    <span className="lb-meta">
                      <b>{b.title}</b>
                      <span className="lb-sub">{b.author}</span>
                      <span className="lb-tag">{b.kind === 'hosted' ? 'Read in Sober Book' : `Free from ${b.from}`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {term && !BOOKS.some(match) && <p className="lb-empty">Nothing matches “{q}”. Try a shorter word.</p>}

      <Link href="/library/shelf" className="lb-myshelf">My Shelf</Link>
      <Link href="/resume" className="lb-rb">
        <b>Resume builder</b>
        <span>A professional resume, ready to send in minutes</span>
      </Link>
    </>
  );
}
