'use client';

import { useEffect, useRef, useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
import { KINDS, TYPES, SUMMARIES, GAPS, SKILLS, LOOKS, blankResume, newWork, checks, matchKeywords, localKeywords } from '../../lib/resume-data';
import Paper from './Paper';

/* =====================================================================
   📝 THE RESUME BUILDER — 9 Nov 2026 (0205).
   From the approved "Resume builder v2" prototype.

   ⭐ ONE QUESTION A SCREEN, TAP TO ADD. Seven steps after the start
      screen. Everything saves by itself as you go.
   ⭐ FREE. PDF and Word are never behind anything.
   🔴 PRIVATE. save_resume()/get_resume() only ever touch your own rows.
   🔴 "Make it professional", the job-ad match and reading an old resume
      go through /api/resume/ai, which is told to never add anything the
      person didn't say. If it's down, the page still works.
   ===================================================================== */

const STEPS = [['you', 'About you'], ['target', 'The job you want'], ['work', 'Your work'], ['gap', 'Time away'],
  ['skills', 'Skills'], ['match', 'Match a job'], ['finish', 'Finish']];

async function helper(body) {
  try {
    const res = await fetch('/api/resume/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return res.ok ? j : { error: j.error || 'The helper didn’t answer. Try again in a minute.' };
  } catch { return { error: 'No connection. Try again in a minute.' }; }
}

function toB64(file) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1] || '');
    fr.onerror = no;
    fr.readAsDataURL(file);
  });
}
/* Photos get shrunk before they go anywhere: a phone photo is 3–8 MB. */
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

const when = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const slug = (s) => String(s || 'Resume').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'Resume';

export default function Builder() {
  const supa = useRef(browserClient()).current;
  const [list, setList] = useState(null);
  const [id, setId] = useState(null);
  const [r, setR] = useState(null);           // null = start screen
  const [step, setStep] = useState(0);
  const [edit, setEdit] = useState(null);     // index of the work entry being edited
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [peek, setPeek] = useState(false);
  const [robot, setRobot] = useState(false);
  const [sure, setSure] = useState(null);
  const [mySkill, setMySkill] = useState('');
  const fileRef = useRef(null);
  const timer = useRef(null);
  const top = useRef(null);

  async function loadList() {
    const { data, error } = await supa.rpc('my_resumes');
    setList(error ? [] : (data || []));
  }
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);

  // autosave, a second after the last change
  useEffect(() => {
    if (!r) return;
    clearTimeout(timer.current);
    // nothing typed yet: don't make an empty "My resume"
    if (!id && !r.name && !r.target && !r.work.length) { setSaved(''); return; }
    setSaved('Saving…');
    timer.current = setTimeout(async () => {
      const { data, error } = await supa.rpc('save_resume', { p_id: id, p_label: r.target || r.name || 'My resume', p_data: r });
      if (error) { setSaved(error.message?.includes('10 resumes') ? 'You have 10 already. Delete one to save this.' : 'Not saved yet'); return; }
      if (!id && data) setId(data);
      setSaved('Saved');
    }, 1000);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line
  }, [r]);

  const go = (n) => { setStep(n); setEdit(null); setErr(''); top.current?.scrollIntoView({ block: 'start' }); };
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const setWork = (i, patch) => setR((x) => ({ ...x, work: x.work.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));

  function begin(start) { setId(null); setR(blankResume(start)); go(0); }

  async function open(rid) {
    setBusy('open');
    const { data } = await supa.rpc('get_resume', { p_id: rid });
    setBusy('');
    if (!data) { setErr('Couldn’t open that one.'); return; }
    setId(rid); setR({ ...blankResume(), ...data }); go(0);
  }

  async function remove(rid) {
    await supa.rpc('delete_resume', { p_id: rid });
    setSure(null); loadList();
  }

  async function readOld(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    if (f.type === 'application/pdf' && f.size > 3_000_000) { setErr('That PDF is too big. Try one under 3 MB, or a photo.'); return; }
    setBusy('read');
    try {
      const isImg = f.type.startsWith('image/');
      const b64 = isImg ? await shrinkPhoto(f) : await toB64(f);
      const j = await helper({ mode: 'read', file: { type: isImg ? 'image/jpeg' : f.type, b64 } });
      if (j.error) { setErr(j.error); return; }
      const x = j.resume || {};
      const base = blankResume('old');
      setId(null);
      setR({ ...base, ...x, work: (x.work || []).map((w) => ({ ...newWork('job'), ...w })), skills: x.skills || [] });
      go(0);
    } catch { setErr('Couldn’t read that file. Try a PDF or a clear photo.'); }
    finally { setBusy(''); }
  }

  async function polish(i) {
    const w = r.work[i];
    if (said.trim().length < 3) { setErr('Write a sentence or two first, like you’d tell a friend.'); return; }
    setBusy('polish'); setErr('');
    const j = await helper({ mode: 'polish', text: said, title: w.title });
    setBusy('');
    if (j.error) { setErr(j.error); return; }
    if (!j.lines?.length) { setErr('Add a little more about what you did there.'); return; }
    const have = new Set(w.bullets);
    setWork(i, { bullets: [...w.bullets, ...j.lines.filter((l) => !have.has(l))] });
    setSaid('');
  }

  async function checkAd() {
    if (r.ad.trim().length < 20) { setErr('Paste the whole job post first.'); return; }
    setBusy('match'); setErr('');
    const j = await helper({ mode: 'match', ad: r.ad });
    setBusy('');
    const kws = j.keywords?.length ? j.keywords : localKeywords(r.ad);
    if (!kws.length) { setErr(j.error || 'Couldn’t find skill words in that post.'); return; }
    set({ adKw: kws });
  }

  async function file(kind) {
    setBusy(kind); setErr('');
    try {
      const ex = await import('../../lib/resume-export');
      const base = `${slug(r.name)}-Resume`;
      if (kind === 'pdf') await ex.deliver(await ex.makePdf(r), base + '.pdf');
      else await ex.deliver(ex.makeDocx(r), base + '.docx');
    } catch { setErr('Couldn’t make the file. Try again.'); }
    finally { setBusy(''); }
  }

  async function copyForAnother() {
    const copy = { ...r, target: '', summary: '', ad: '', adKw: [] };
    const { data, error } = await supa.rpc('save_resume', { p_id: null, p_label: 'New version', p_data: copy });
    if (error) { setErr(error.message?.includes('10 resumes') ? 'You have 10 resumes. Delete one to make another.' : 'Couldn’t make a copy.'); return; }
    setId(data); setR(copy); go(1);
  }

  /* ---------------- START SCREEN ---------------- */
  if (!r) {
    return (
      <div className="rs" ref={top}>
        <div className="rs-hero">
          <div className="rs-eyebrow">Free · no trial, no card</div>
          <h1 className="rs-big">Build a resume that gets you hired</h1>
          <p className="rs-p">One easy question at a time. It looks professional, it reads clean to hiring software, and it’s yours to save as a PDF or Word file.</p>
        </div>

        {list && list.length > 0 && (
          <section className="rs-stack">
            <div className="rs-lab">Your resumes</div>
            {list.map((x) => (
              <div key={x.id} className="rs-saved">
                <button type="button" className="rs-open" onClick={() => open(x.id)} disabled={!!busy}>
                  <b>{x.label || 'My resume'}</b><span>Updated {when(x.updated_at)}</span>
                </button>
                {sure === x.id
                  ? <button type="button" className="rs-del sure" onClick={() => remove(x.id)}>Yes, delete</button>
                  : <button type="button" className="rs-del" onClick={() => setSure(x.id)} aria-label={`Delete ${x.label || 'resume'}`}>Delete</button>}
              </div>
            ))}
          </section>
        )}

        <section className="rs-stack">
          <div className="rs-lab">{list && list.length ? 'Start a new one' : 'How do you want to start?'}</div>
          <button type="button" className="rs-way" onClick={() => begin('fresh')}><em>✍️</em><span><b>Start fresh</b><span>One easy question at a time</span></span></button>
          <button type="button" className="rs-way" onClick={() => fileRef.current?.click()} disabled={busy === 'read'}>
            <em>📄</em><span><b>{busy === 'read' ? 'Reading your resume…' : 'I have an old resume'}</b><span>Upload the PDF or a photo of it and we fill it in</span></span></button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={readOld} />
          <button type="button" className="rs-way" onClick={() => begin('none')}><em>🌱</em><span><b>I don’t have much work history</b><span>We’ll build it from training, service work and life skills</span></span></button>
        </section>

        <div className="rs-free"><span aria-hidden="true">💚</span><span><b>Your resume is yours.</b> Save it as a PDF or Word file as many times as you want. No paywall at the end. It’s private and never shows on your profile.</span></div>
        {err && <p className="rs-err" role="alert">{err}</p>}
      </div>
    );
  }

  /* ---------------- STEPS ---------------- */
  const key = STEPS[step][0];
  const lib = KINDS[r.kind] || KINDS.Warehouse;
  const tip = (t) => <div className="rs-tip"><span aria-hidden="true">💡</span><span>{t}</span></div>;
  const field = (label, k, ph, type = 'text', extra = {}) => (
    <label className="rs-field"><span className="rs-lab">{label}</span>
      <input className="rs-in" type={type} value={r[k] || ''} placeholder={ph} onChange={(e) => set({ [k]: e.target.value })} {...extra} /></label>
  );

  let body = null;
  if (key === 'you') body = (<>
    <h1 className="rs-q">Let’s start with you</h1>
    <p className="rs-p">Just the basics. No street address needed; town and state is plenty.</p>
    {field('Your name', 'name', 'First and last name', 'text', { autoComplete: 'name', maxLength: 80 })}
    {field('Town, state', 'town', 'Cadiz, OH', 'text', { maxLength: 80 })}
    {field('Phone', 'phone', '(740) 555-0100', 'tel', { autoComplete: 'tel', maxLength: 30 })}
    {field('Email', 'email', 'first.last@email.com', 'email', { autoComplete: 'email', maxLength: 120 })}
    {tip(<><b>Use a plain email,</b> like firstname.lastname@… It’s the first thing a hiring manager sees.</>)}
  </>);

  if (key === 'target') body = (<>
    <h1 className="rs-q">What job are you going for?</h1>
    <p className="rs-p">This goes at the top of your resume and sets the lines we suggest.</p>
    {field('Job title', 'target', 'Warehouse Associate', 'text', { maxLength: 80 })}
    <span className="rs-lab">Kind of work</span>
    <div className="rs-chips">{Object.keys(KINDS).map((k) => (
      <button key={k} type="button" className="rs-chip" aria-pressed={r.kind === k} onClick={() => set({ kind: k })}>{k}</button>))}</div>
    <span className="rs-lab">Pick an opening line</span>
    <div className="rs-sug">{SUMMARIES(r.target).map((x, i) => (
      <button key={i} type="button" aria-pressed={r.summary === x} onClick={() => set({ summary: x })}><b>{r.summary === x ? '✓' : '+'}</b><span>{x}</span></button>))}</div>
    <label className="rs-field"><span className="rs-lab">Or write your own</span>
      <textarea className="rs-ta" value={r.summary} maxLength={600} onChange={(e) => set({ summary: e.target.value })} placeholder="Two sentences about the worker you are." /></label>
  </>);

  if (key === 'work' && edit === null) body = (<>
    <h1 className="rs-q">Your work</h1>
    <p className="rs-p">Most recent first. Any work counts: part-time, temp, side jobs, service, training.</p>
    {r.start === 'none' && tip(<><b>Not much work history? That’s okay.</b> Add a training program, volunteer or service work, or work you did while incarcerated. It all counts.</>)}
    {r.work.length === 0 && <p className="rs-empty">Nothing here yet.</p>}
    {r.work.map((w, i) => (
      <div key={w.id || i} className="rs-entry">
        <div><b>{w.title || 'Untitled'}</b><span>{[w.where, [w.from, w.to].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
          <span>{(w.bullets || []).filter(Boolean).length} lines</span></div>
        <div className="rs-erow">
          <button type="button" onClick={() => { setEdit(i); setSaid(''); }}>Edit</button>
          {i > 0 && <button type="button" onClick={() => { const a = [...r.work]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ work: a }); }} aria-label="Move up">↑</button>}
          <button type="button" onClick={() => set({ work: r.work.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      </div>
    ))}
    <button type="button" className="rs-add" onClick={() => { set({ work: [...r.work, newWork(r.start === 'none' && !r.work.length ? 'training' : 'job')] }); setEdit(r.work.length); setSaid(''); }}>+ Add work</button>
  </>);

  if (key === 'work' && edit !== null && r.work[edit]) {
    const w = r.work[edit];
    const T = TYPES[w.type] || TYPES.job;
    body = (<>
      <h1 className="rs-q">{w.title || 'Tell us about this work'}</h1>
      <span className="rs-lab">What kind was it?</span>
      <div className="rs-chips">{Object.entries(TYPES).map(([k, v]) => (
        <button key={k} type="button" className="rs-chip" aria-pressed={w.type === k}
          onClick={() => setWork(edit, { type: k, where: (!w.where || Object.values(TYPES).some((t) => t.where === w.where)) ? v.where : w.where })}>{v.label}</button>))}</div>
      {T.tip && tip(T.tip)}
      <label className="rs-field"><span className="rs-lab">Job title</span>
        <input className="rs-in" value={w.title} maxLength={80} placeholder="Warehouse Associate" onChange={(e) => setWork(edit, { title: e.target.value })} /></label>
      <label className="rs-field"><span className="rs-lab">Where</span>
        <input className="rs-in" value={w.where} maxLength={120} placeholder="Company name" onChange={(e) => setWork(edit, { where: e.target.value })} /></label>
      {w.type === 'job' && <label className="rs-field"><span className="rs-lab">Town, state (optional)</span>
        <input className="rs-in" value={w.town} maxLength={80} placeholder="Steubenville, OH" onChange={(e) => setWork(edit, { town: e.target.value })} /></label>}
      <div className="rs-two">
        <label className="rs-field"><span className="rs-lab">Started</span><input className="rs-in" value={w.from} maxLength={20} placeholder="2021" onChange={(e) => setWork(edit, { from: e.target.value })} /></label>
        <label className="rs-field"><span className="rs-lab">Ended</span><input className="rs-in" value={w.to} maxLength={20} placeholder="Present" onChange={(e) => setWork(edit, { to: e.target.value })} /></label>
      </div>

      <div className="rs-rew">
        <span className="rs-lab">Say it your way</span>
        <textarea className="rs-ta" value={said} maxLength={1500} onChange={(e) => setSaid(e.target.value)}
          placeholder="Like you’d tell a friend: I loaded trucks, drove the forklift and trained the new guys." />
        <button type="button" className="rs-mk" onClick={() => polish(edit)} disabled={busy === 'polish'}>{busy === 'polish' ? 'Working on it…' : '✨ Make it professional'}</button>
        <span className="rs-small">Only turns what you wrote into resume language. It never adds things you didn’t do.</span>
      </div>

      <span className="rs-lab">Your lines</span>
      {(w.bullets || []).length === 0 && <p className="rs-empty">Add 3 to 5 lines. Use the box above, or tap some below.</p>}
      {(w.bullets || []).map((b, j) => (
        <div key={j} className="rs-line">
          <input className="rs-in" value={b} maxLength={160} aria-label={`Line ${j + 1}`}
            onChange={(e) => setWork(edit, { bullets: w.bullets.map((x, k) => (k === j ? e.target.value : x)) })} />
          <button type="button" aria-label="Remove line" onClick={() => setWork(edit, { bullets: w.bullets.filter((_, k) => k !== j) })}>✕</button>
        </div>
      ))}
      <button type="button" className="rs-add slim" onClick={() => setWork(edit, { bullets: [...(w.bullets || []), ''] })}>+ Write a line</button>

      <span className="rs-lab">Or tap lines to add ({r.kind})</span>
      <div className="rs-sug">{lib.map((x, j) => {
        const on = (w.bullets || []).includes(x);
        return <button key={j} type="button" aria-pressed={on}
          onClick={() => setWork(edit, { bullets: on ? w.bullets.filter((b) => b !== x) : [...(w.bullets || []), x] })}><b>{on ? '✓' : '+'}</b><span>{x}</span></button>;
      })}</div>
      {tip(<><b>Numbers stand out.</b> “Packed 150 orders a shift” beats “packed orders.” Change any line to fit what you really did.</>)}
    </>);
  }

  if (key === 'gap') body = (<>
    <h1 className="rs-q">Any time away from work?</h1>
    <p className="rs-p">Lots of people have gaps. You never have to explain why. Pick what feels right, or leave it off.</p>
    <div className="rs-sug">{Object.entries(GAPS).map(([k, v]) => (
      <button key={k} type="button" aria-pressed={r.gap === k} onClick={() => set({ gap: k })}><b>{r.gap === k ? '✓' : '+'}</b><span>{v.label}</span></button>))}</div>
    {r.gap !== 'none' && field('Since (year)', 'gapFrom', '2023', 'text', { inputMode: 'numeric', maxLength: 20 })}
    <div className="rs-sw"><div><b>Show years only</b><span>“2021 – 2023” instead of months. Short gaps disappear.</span></div>
      <button type="button" className="rs-toggle" role="switch" aria-checked={r.years} aria-label="Show years only" onClick={() => set({ years: !r.years })} /></div>
    {tip(<><b>You don’t have to bring up your record or recovery</b> on a resume. If it comes up in an interview, keep it short: what happened, what you’ve done since, why you’re ready.</>)}
  </>);

  if (key === 'skills') {
    const all = [...SKILLS, ...r.skills.filter((s) => !SKILLS.includes(s))];
    body = (<>
      <h1 className="rs-q">What are you good at?</h1>
      <p className="rs-p">Tap everything that fits. 5 to 8 is the sweet spot.</p>
      <div className="rs-chips">{all.map((k) => {
        const on = r.skills.includes(k);
        return <button key={k} type="button" className="rs-chip" aria-pressed={on} onClick={() => set({ skills: on ? r.skills.filter((s) => s !== k) : [...r.skills, k] })}>{k}</button>;
      })}</div>
      <form className="rs-line" onSubmit={(e) => { e.preventDefault(); const v = mySkill.trim(); if (v && !r.skills.includes(v)) set({ skills: [...r.skills, v.slice(0, 40)] }); setMySkill(''); }}>
        <input className="rs-in" value={mySkill} maxLength={40} placeholder="Add your own skill" onChange={(e) => setMySkill(e.target.value)} aria-label="Add your own skill" />
        <button type="submit" aria-label="Add skill">＋</button>
      </form>
      {field('School', 'edu', 'High school diploma · Harrison Central High School', 'text', { maxLength: 160 })}
      {field('Certificates (optional)', 'certs', 'OSHA 10 · Forklift Operator Certification', 'text', { maxLength: 160 })}
    </>);
  }

  if (key === 'match') {
    const m = matchKeywords(r, r.adKw);
    const hits = m.filter((x) => x.hit).length;
    body = (<>
      <h1 className="rs-q">Match it to a job ad</h1>
      <p className="rs-p">Optional, but it helps. Paste a job post and we’ll show which of its words are on your resume. Hiring software looks for them.</p>
      <textarea className="rs-ta tall" value={r.ad} maxLength={6000} onChange={(e) => set({ ad: e.target.value, adKw: [] })} placeholder="Paste the job post here" />
      <button type="button" className="rs-mk" onClick={checkAd} disabled={busy === 'match'}>{busy === 'match' ? 'Reading the ad…' : 'Check my resume against it'}</button>
      {m.length > 0 && (<>
        <div className="rs-meter"><b>{hits}/{m.length}</b><span>words from the ad are on your resume. Tap a grey one to add it to your skills, <strong>only if it’s true.</strong></span></div>
        <div className="rs-kw">{m.map((x) => x.hit
          ? <span key={x.k} className="hit">✓ {x.k}</span>
          : <button key={x.k} type="button" className="miss" onClick={() => { const v = x.k.replace(/^./, (c) => c.toUpperCase()); if (!r.skills.includes(v)) set({ skills: [...r.skills, v] }); }}>+ {x.k}</button>)}</div>
      </>)}
    </>);
  }

  if (key === 'finish') {
    const c = checks(r);
    const ok = c.filter((x) => x[1]).length;
    body = (<>
      <div className="rs-done"><div className="rs-seal" aria-hidden="true">📝</div><h1 className="rs-q">Your resume is ready</h1><p className="rs-p">Pick a look. Every look reads clean to hiring software.</p></div>
      <div className="rs-looks">{LOOKS.map(([v, l]) => (
        <button key={v} type="button" className={'rs-look ' + v} aria-pressed={r.look === v} onClick={() => set({ look: v })}><i aria-hidden="true" />{l}</button>))}</div>
      <Paper r={r} />
      <div className="rs-meter"><b>{ok}/{c.length}</b><span>Ready-to-send check</span></div>
      <div className="rs-check">{c.map(([l, v]) => <div key={l} className={v ? '' : 'no'}>{l}</div>)}</div>
      <button type="button" className="rs-go" onClick={() => file('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Making your PDF…' : '⬇ Save as PDF'}</button>
      <button type="button" className="rs-ghost" onClick={() => file('docx')} disabled={!!busy}>{busy === 'docx' ? 'Making your Word file…' : 'Save as Word file'}</button>
      <button type="button" className="rs-ghost" onClick={copyForAnother}>Make a version for another job</button>
      <div className="rs-free"><span aria-hidden="true">💚</span><span><b>Free. No trial, no card, no catch.</b> Saved privately to your account so you can update it any time.</span></div>
    </>);
  }

  return (
    <div className="rs" ref={top}>
      <div className="rs-prog" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="rs-stepn"><span>Step {step + 1} of {STEPS.length} · {STEPS[step][1]}</span><span className="rs-saved-st" aria-live="polite">{saved}</span></div>
      {peek && (
        <div className="rs-sheet" role="dialog" aria-label="Your resume">
          <div className="rs-sheethd">
            <div className="rs-tabs">
              <button type="button" aria-pressed={!robot} onClick={() => setRobot(false)}>What people see</button>
              <button type="button" aria-pressed={robot} onClick={() => setRobot(true)}>🤖 Robot view</button>
            </div>
            <button type="button" className="rs-x" onClick={() => setPeek(false)} aria-label="Close">✕</button>
          </div>
          {robot && <p className="rs-small">This is exactly what hiring software reads. If it reads clean here, it passes.</p>}
          <Paper r={r} robot={robot} />
        </div>
      )}

      <div className="rs-stack">{body}</div>
      {err && <p className="rs-err" role="alert">{err}</p>}

      <div className="rs-nav">
        <button type="button" className="rs-back" onClick={() => (edit !== null ? setEdit(null) : step === 0 ? (setR(null), loadList()) : go(step - 1))}>Back</button>
        <button type="button" className="rs-peek" onClick={() => { setPeek(!peek); setRobot(false); if (!peek) top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }} aria-pressed={peek}>👁 See it</button>
        {edit !== null
          ? <button type="button" className="rs-next" onClick={() => setEdit(null)}>Done</button>
          : step < STEPS.length - 1
            ? <button type="button" className="rs-next" onClick={() => go(step + 1)}>Next</button>
            : <button type="button" className="rs-next" onClick={() => { setR(null); setId(null); loadList(); }}>Done</button>}
      </div>
    </div>
  );
}
