'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { place, setPlace } from './shelf-store';
import { track } from '../../lib/track';

/* =====================================================================
   THE READER — 27 Nov 2026 (Kenny, drop 2).

   One chapter at a time, in a calm book typeface, with plenty of room.
   Text size and Paper / Night Room are remembered on this phone; so is
   the chapter you were on. Nothing about reading leaves the device.

   The text comes from /public/library/<id>.json, converted word for word
   from the Standard Ebooks source (see books.js). React renders it as
   text, never as HTML.
   ===================================================================== */
const PREFS = 'sb_lib_prefs';   // { size: 18, night: false }
const SIZES = [16, 18, 20, 22, 24];

function loadPrefs() {
  try { return { size: 18, night: false, ...(JSON.parse(localStorage.getItem(PREFS) || '{}')) }; }
  catch { return { size: 18, night: false }; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* fine */ } }

export default function Reader({ id, title }) {
  const [book, setBook] = useState(null);
  const [err, setErr] = useState(false);
  const [ch, setCh] = useState(0);
  const [prefs, setPrefs] = useState({ size: 18, night: false });
  const [toc, setToc] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    const p = place(id);
    if (p) setCh(p.ch);
    fetch(`/library/${id}.json`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setBook)
      .catch(() => setErr(true));
    track('library.read', { book: id });
  }, [id]);

  useEffect(() => {
    if (!book) return;
    const safe = Math.min(Math.max(0, ch), book.chapters.length - 1);
    if (safe !== ch) { setCh(safe); return; }
    setPlace(id, safe);
  }, [book, ch, id]);

  function go(n) {
    setCh(n);
    setToc(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }
  function setSize(d) {
    const i = Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(prefs.size) + d));
    const p = { ...prefs, size: SIZES[i] }; setPrefs(p); savePrefs(p);
  }
  function setNight(night) { const p = { ...prefs, night }; setPrefs(p); savePrefs(p); }

  const chapter = book && book.chapters[ch];
  const last = book ? book.chapters.length - 1 : 0;

  return (
    <div className={'rd' + (prefs.night ? ' night' : '')}>
      <div className="rd-top">
        <Link href={`/library/${id}`} className="rd-back">← {title}</Link>
        <button type="button" className="rd-toc-btn" aria-expanded={toc} onClick={() => setToc(!toc)}>Contents</button>
      </div>

      {toc && book && (
        <nav className="rd-toc" aria-label="Contents">
          <ol>
            {book.chapters.map((c, i) => (
              <li key={i}>
                <button type="button" className={i === ch ? 'on' : ''} onClick={() => go(i)}>{c.title || `Part ${i + 1}`}</button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <article className="rd-text" style={{ fontSize: prefs.size }} aria-live="polite">
        {err && <p className="rd-msg">This book didn’t load. Check your connection and try again.</p>}
        {!err && !book && <p className="rd-msg">Opening the book…</p>}
        {chapter && (
          <>
            <h1 className="rd-ch">{chapter.title}</h1>
            {chapter.paras.map((p, i) => <p key={i}>{p}</p>)}
          </>
        )}
      </article>

      {book && (
        <div className="rd-pager">
          <button type="button" disabled={ch === 0} onClick={() => go(ch - 1)}>← Previous</button>
          <span className="rd-pos">{ch + 1} of {last + 1}</span>
          <button type="button" disabled={ch === last} onClick={() => go(ch + 1)}>Next →</button>
        </div>
      )}

      <div className="rd-set" role="group" aria-label="Reading settings">
        <div className="rd-row">
          <span>Text size</span>
          <span className="rd-btns">
            <button type="button" aria-label="Smaller text" onClick={() => setSize(-1)}>A−</button>
            <button type="button" aria-label="Larger text" onClick={() => setSize(1)} style={{ fontSize: 18 }}>A+</button>
          </span>
        </div>
        <div className="rd-row">
          <button type="button" className={'rd-mode' + (!prefs.night ? ' on' : '')} aria-pressed={!prefs.night} onClick={() => setNight(false)}>Paper</button>
          <button type="button" className={'rd-mode dark' + (prefs.night ? ' on' : '')} aria-pressed={prefs.night} onClick={() => setNight(true)}>Night Room</button>
        </div>
        {book && <p className="rd-src">From {book.source}. {book.rights}</p>}
      </div>
    </div>
  );
}
