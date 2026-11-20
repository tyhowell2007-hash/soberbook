'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import './banner.css';

/* =====================================================================
   <Banner page="home|feed|more" kind="prompt|partner|any" />
   Jesse's banner test (Helios plan, 19 Nov 2026; Ty: "go", 20 Nov).
   Migration 0208_banner_test.

   Two banners, one per page, in Jesse's fonts and colours on the website
   AND in the app — the rest of the website stays Sober Book until the
   name rolls out (Ty, 19 Nov: "We still want to be somewhat secret").
     rb_prompt  "What does Recovery Belongs mean to you?"  Home, More
     helios     "From a Sober Book partner"                feed, More
   Meetings is the control page and never gets one.

   🔴 NEVER put this on Messages, Rooms, Talk Rooms, Quiet, the posting
   box, a post's replies, check-in, pledge, Right now, 988 or any crisis
   or safety screen. That rule is the plan's, and Ty signed it.

   What it records (banner_mark): a view, a tap, a hide, a report —
   counted per banner, page and day, with NO member id. Hide and report
   also hide it for that member for 30 days. An answer (banner_answer)
   is saved with no author at all.

   ⚠️ Renders nothing if the RPC fails or the migration hasn't run, so
   the code can go up before the SQL.
   ===================================================================== */

const TAGS = [
  ['abstinence', 'Abstinence'],
  ['harm_reduction', 'Harm reduction'],
  ['medication', 'Medication-assisted'],
  ['family_ally', 'Family or ally'],
  ['other', 'Other'],
];

export default function Banner({ page, kind = 'any' }) {
  const [b, setB] = useState(null);
  const [gone, setGone] = useState(false);
  const [asking, setAsking] = useState(false);   // the hide choices
  const [sheet, setSheet] = useState(false);
  const [thanks, setThanks] = useState(false);
  const box = useRef(null);
  const supabase = useRef(null);

  function client() {
    if (!supabase.current) supabase.current = browserClient();
    return supabase.current;
  }
  function mark(what) {
    if (!b) return;
    try { client().rpc('banner_mark', { p_banner: b.id, p_page: page, p_kind: what }).then(() => {}, () => {}); } catch { /* never in the way */ }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error } = await client().rpc('banners_for', { p_page: page });
        if (!live || error || !Array.isArray(data)) return;
        const pick = data.find((x) => kind === 'any' || x.kind === kind);
        if (pick) setB(pick);
      } catch { /* nothing shows */ }
    })();
    return () => { live = false; };
  }, [page, kind]);

  // one view per banner, page and visit, once half of it is on screen
  useEffect(() => {
    if (!b || !box.current || typeof IntersectionObserver === 'undefined') return;
    const key = 'bnv:' + b.id + ':' + page;
    try { if (sessionStorage.getItem(key)) return; } catch { /* count it */ }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        try { sessionStorage.setItem(key, '1'); } catch { /* fine */ }
        mark('view');
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [b]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || gone) return null;

  if (thanks) {
    return (
      <div className={'bnr bnr-prompt bnr-thanks bnr-at-' + page} role="status">
        <div className="bnr-lab">Thank you</div>
        <p className="bnr-p">Got it. A person on our team reads every answer. Your name never goes with it.</p>
      </div>
    );
  }

  const hideRow = asking && (
    <div className="bnr-ask">
      <button type="button" onClick={() => { mark('hide'); setGone(true); }}>Hide for 30 days</button>
      <button type="button" onClick={() => { mark('report'); setGone(true); }}>Hide and tell us it felt off</button>
      <button type="button" className="bnr-keep" onClick={() => setAsking(false)}>Keep it</button>
    </div>
  );

  if (b.kind === 'partner') {
    return (
      <aside ref={box} className={'bnr bnr-partner bnr-at-' + page} aria-label={'From a Sober Book partner: ' + (b.partner_name || b.title)}>
        <div className="bnr-lab">From a Sober Book partner</div>
        <button type="button" className="bnr-hide" onClick={() => setAsking((v) => !v)} aria-expanded={asking}>Hide this ✕</button>
        <div className="bnr-pr">
          {b.logo_url
            ? <img className="bnr-logo" src={b.logo_url} alt="" width="46" height="46" />
            : <span className="bnr-logo bnr-logo-t" aria-hidden="true">{(b.partner_name || b.title).split(' ')[0].slice(0, 7).toUpperCase()}</span>}
          <div className="bnr-pt">
            <h4>{b.title}</h4>
            {b.body && <p>{b.body}</p>}
          </div>
        </div>
        <a className="bnr-lnk" href={b.link_url} target="_blank" rel="noopener noreferrer" onClick={() => mark('tap')}>
          Open the resource ↗
        </a>
        {hideRow}
      </aside>
    );
  }

  return (
    <>
      <aside ref={box} className={'bnr bnr-prompt bnr-at-' + page} aria-label="A question from us">
        <div className="bnr-lab">A question from us</div>
        <button type="button" className="bnr-hide" onClick={() => setAsking((v) => !v)} aria-expanded={asking}>Hide this ✕</button>
        <h4 className="bnr-h">{b.title}</h4>
        {b.body && <p className="bnr-p">{b.body}</p>}
        <button type="button" className="bnr-go" onClick={() => { mark('tap'); setSheet(true); }}>Answer →</button>
        {hideRow}
      </aside>
      {sheet && (
        <AnswerSheet banner={b} page={page} client={client}
                     onClose={() => setSheet(false)}
                     onSent={() => { setSheet(false); setThanks(true); }} />
      )}
    </>
  );
}

function AnswerSheet({ banner, page, client, onClose, onSent }) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState(null);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const can = (text.trim() || tag) && !busy;

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function send() {
    if (!can) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await client().rpc('banner_answer', {
        p_banner: banner.id, p_page: page, p_answer: text.trim() || null, p_tag: tag, p_share: share,
      });
      if (error) throw error;
      if (data === false) { setErr('Looks like you already answered this one. Thank you.'); setBusy(false); return; }
      onSent();
    } catch {
      setErr('That didn’t send. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <div className="bnr-sheetbg" onClick={onClose}>
      <div className="bnr-sheet" role="dialog" aria-modal="true" aria-labelledby="bnr-sh-h" onClick={(e) => e.stopPropagation()}>
        <div className="bnr-grab" aria-hidden="true" />
        <h4 id="bnr-sh-h" className="bnr-h">{banner.title}</h4>
        <p className="bnr-q">Optional. Skip anything you want.</p>
        <label htmlFor="bnr-text" className="bnr-sr">Your answer</label>
        <textarea id="bnr-text" maxLength={280} placeholder="It means…" value={text}
                  onChange={(e) => setText(e.target.value)} />
        <div className="bnr-tl">How you relate to recovery (optional)</div>
        <div className="bnr-chips" role="group" aria-label="How you relate to recovery">
          {TAGS.map(([k, l]) => (
            <button key={k} type="button" className={'bnr-chip' + (tag === k ? ' on' : '')}
                    aria-pressed={tag === k} onClick={() => setTag(tag === k ? null : k)}>{l}</button>
          ))}
        </div>
        <label className="bnr-consent">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          <span>You can use my words, without my name, in Recovery Belongs materials.</span>
        </label>
        <p className="bnr-small">A person reads every answer before anyone else sees it. Your name never goes with it.
          Having a hard time right now? Call or text <a href="tel:988">988</a>, any hour.</p>
        {err && <p className="bnr-err" role="alert">{err}</p>}
        <div className="bnr-btns">
          <button type="button" className="bnr-no" onClick={onClose}>Not now</button>
          <button type="button" className="bnr-send" disabled={!can} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
