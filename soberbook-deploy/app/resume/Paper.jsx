'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { blocks, robotText } from '../../lib/resume-data';

/* The resume on screen: a real 8.5×11 sheet drawn at 816px wide, scaled
   down to fit the phone. Same blocks() as the PDF and Word files. */
export default function Paper({ r, robot = false }) {
  const box = useRef(null);
  const sheet = useRef(null);
  const [s, setS] = useState(0.4);
  const [h, setH] = useState(400);

  useLayoutEffect(() => {
    const fit = () => {
      if (!box.current || !sheet.current) return;
      const k = Math.min(1, box.current.clientWidth / 816);
      setS(k);
      setH(sheet.current.offsetHeight * k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (sheet.current) ro.observe(sheet.current);
    return () => ro.disconnect();
  }, [robot, r.look]);

  if (robot) return <pre className="rs-robot" aria-label="What hiring software reads">{robotText(r)}</pre>;

  const B = blocks(r);
  const head = B.filter((b) => ['name', 'title', 'contact'].includes(b.k));
  const rest = B.filter((b) => !head.includes(b));
  const draw = (b, i) => {
    if (b.k === 'name') return <div key={i} className="rp-name">{b.t}</div>;
    if (b.k === 'title') return <div key={i} className="rp-title">{b.t}</div>;
    if (b.k === 'contact') return <div key={i} className="rp-contact">{b.items.map((x, j) => <span key={j}>{x}</span>)}</div>;
    if (b.k === 'h') return <div key={i} className="rp-h">{b.t}</div>;
    if (b.k === 'p') return <p key={i} className="rp-p">{b.t}</p>;
    if (b.k === 'skills') return <div key={i} className="rp-skills">{b.items.map((x, j) => <span key={j}>{x}</span>)}</div>;
    if (b.k === 'job') return (
      <div key={i} className="rp-job">
        <div className="rp-jh"><b>{b.title}</b>{b.dates ? <span>{b.dates}</span> : null}</div>
        {b.sub ? <div className="rp-co">{b.sub}</div> : null}
        {b.note ? <p className="rp-p">{b.note}</p> : null}
        {b.bullets.length ? <ul className="rp-ul">{b.bullets.map((x, j) => <li key={j}>{x}</li>)}</ul> : null}
      </div>
    );
    return null;
  };

  return (
    <div className="rs-paperbox" ref={box} style={{ height: h }}>
      <div ref={sheet} className={'rp rp-' + (r.look || 'modern')} style={{ transform: `scale(${s})` }}>
        <div className="rp-head">{head.map(draw)}</div>
        <div className="rp-main">{rest.map(draw)}</div>
      </div>
    </div>
  );
}
