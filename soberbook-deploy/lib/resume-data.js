/* =====================================================================
   📝 RESUME BUILDER — the words and the shape.  9 Nov 2026 (0205).

   ⚠️ NO 'use client'. Plain data and pure functions, shared by the
   builder screen, the on-screen paper, the robot view and the PDF/Word
   export, so all four always say exactly the same thing.

   🔴 THE LINES ARE THINGS PEOPLE REALLY DO IN THESE JOBS, NOT CLAIMS.
   Anything with a number in it ("150+ orders a shift") is a starting
   point the member is told to change to fit what they really did.
   ===================================================================== */

export const KINDS = {
  'Warehouse': ['Picked, packed and shipped orders accurately and on time', 'Loaded and unloaded trucks safely and on schedule', 'Kept inventory counts accurate using handheld RF scanners', 'Operated forklift and pallet jack safely', 'Trained new hires on safety and picking routes', 'Handled shipping and receiving paperwork'],
  'Food service': ['Prepared food fast and to recipe during busy rushes', 'Kept the kitchen clean and up to health code', 'Worked as a team to serve guests quickly and well', 'Handled food prep, stocking and closing duties', 'Stayed calm and friendly under pressure'],
  'Construction': ['Read plans and measured, cut and installed materials', 'Operated power tools and equipment safely', 'Kept job sites clean and organized', 'Finished tasks on time alongside a crew', 'Followed OSHA safety rules every day'],
  'Manufacturing': ['Ran production machines and met daily quotas', 'Checked parts for quality and caught defects early', 'Followed safety and lockout procedures', 'Kept the line stocked and the work area clean', 'Worked rotating shifts reliably'],
  'Retail': ['Helped customers find what they needed', 'Ran the register and handled cash accurately', 'Stocked shelves and kept the floor neat', 'Opened and closed the store', 'Handled returns and questions with patience'],
  'Driving': ['Delivered on time on local routes', 'Kept a clean driving record', 'Inspected the vehicle before every shift', 'Loaded and secured cargo safely', 'Talked with customers professionally at every stop'],
  'Cleaning': ['Cleaned and sanitized buildings to a high standard', 'Used cleaning chemicals and equipment safely', 'Worked independently on a set schedule', 'Restocked supplies and reported repairs'],
  'Landscaping': ['Mowed, trimmed and maintained client properties', 'Operated mowers, trimmers and blowers safely', 'Planted, mulched and kept beds looking sharp', 'Worked outdoors in all weather on a crew'],
  'Caregiving': ['Helped clients with daily living and routines', 'Kept careful notes and followed care plans', 'Built trust with clients and families', 'Kept spaces safe and clean', 'Stayed patient, kind and dependable'],
  'Office': ['Answered phones and greeted visitors', 'Kept files and schedules organized', 'Entered data accurately in Word and Excel', 'Handled emails and paperwork on deadline'],
};

/* What kind of work an entry was. `where` pre-fills the "Where" box. */
export const TYPES = {
  job:      { label: 'Paid job', where: '', tip: '' },
  inside:   { label: 'Work while incarcerated', where: 'Ohio Dept. of Rehabilitation and Correction (ODRC)',
              tip: 'List it like any job: the work you did and the skills you built. Using the agency’s initials is normal.' },
  service:  { label: 'Volunteer or service', where: 'Community support group',
              tip: 'Service work counts: chairing, setting up, keeping the money straight. You choose how much to say; “community support group” keeps it private.' },
  training: { label: 'Training program', where: 'Workforce training program',
              tip: 'Programs, certificates and classes show you’re building skills right now.' },
};

export const SUMMARIES = (t) => {
  const job = String(t || 'worker').trim().toLowerCase() || 'worker';
  return [
    `Dependable ${job} who shows up, works hard and gets it right. Known for safety, a steady pace and being someone the team can count on.`,
    `Hard-working ${job} with hands-on experience and a strong work ethic. Learns fast, follows through and takes pride in doing the job well.`,
    `Reliable, team-first worker ready to bring energy and focus to a ${job} role. Punctual, safety-minded and easy to work with.`,
  ];
};

export const GAPS = {
  health:   { label: 'Focused on health and personal growth', line: 'Took time to focus on health and personal growth. Ready and committed to returning to full-time work.' },
  family:   { label: 'Cared for family', line: 'Took time away to care for family. Ready and committed to returning to full-time work.' },
  training: { label: 'Training and new certifications', line: 'Focused on training and personal development, including new certifications.' },
  none:     { label: 'Leave it off', line: '' },
};

export const SKILLS = ['Forklift certified', 'Inventory counts', 'Safety-first', 'Team player', 'Reliable attendance',
  'RF scanners', 'Shipping & receiving', 'Lifting 50+ lbs', 'Customer service', 'Cash handling', 'Food safety (ServSafe)',
  'Power tools', 'CDL Class A', 'Bilingual (English/Spanish)', 'Microsoft Word & Excel', 'Time management',
  'Problem solving', 'Clean driving record', 'Quality control', 'Machine operation', 'Patient care', 'Scheduling'];

export const LOOKS = [['classic', 'Classic'], ['modern', 'Modern'], ['bold', 'Bold']];

export function blankResume(start = 'fresh') {
  return {
    v: 1, start, name: '', town: '', phone: '', email: '',
    target: '', kind: 'Warehouse', summary: '',
    work: [], gap: 'none', gapFrom: '', years: true,
    skills: [], edu: '', certs: '', look: 'modern', ad: '', adKw: [],
  };
}

export function newWork(type = 'job') {
  return { id: Math.random().toString(36).slice(2, 10), type, title: '', where: TYPES[type]?.where || '',
           town: '', from: '', to: '', bullets: [] };
}

/* "2021" stays "2021"; "March 2021" becomes "2021" when years-only is on. */
export function dateRange(r, from, to) {
  const y = (s) => {
    const t = String(s || '').trim();
    if (!r.years) return t;
    const m = t.match(/(19|20)\d{2}/);
    return m ? m[0] : t;
  };
  const a = y(from), b = y(to) || 'Present';
  return a ? `${a} – ${b}` : (to ? b : '');
}

/* The resume as ordered blocks — the ONE layout every output draws from. */
export function blocks(r) {
  const out = [];
  out.push({ k: 'name', t: r.name || 'Your Name' });
  if (r.target) out.push({ k: 'title', t: r.target });
  const contact = [r.town, r.phone, r.email].map((x) => String(x || '').trim()).filter(Boolean);
  if (contact.length) out.push({ k: 'contact', items: contact });
  if (r.summary) { out.push({ k: 'h', t: 'Summary' }); out.push({ k: 'p', t: r.summary }); }
  const gap = GAPS[r.gap]?.line;
  const work = (r.work || []).filter((w) => w.title || w.where || (w.bullets || []).length);
  if (gap || work.length) {
    out.push({ k: 'h', t: 'Experience' });
    if (gap) out.push({ k: 'job', title: 'Career break', dates: dateRange(r, r.gapFrom, ''), sub: '', bullets: [], note: gap });
    for (const w of work) {
      const sub = [w.where, w.type === 'job' ? w.town : ''].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
      out.push({ k: 'job', title: w.title || 'Job title', dates: dateRange(r, w.from, w.to), sub,
                 bullets: (w.bullets || []).map((b) => String(b || '').trim()).filter(Boolean) });
    }
  }
  const skills = (r.skills || []).filter(Boolean);
  if (skills.length) { out.push({ k: 'h', t: 'Skills' }); out.push({ k: 'skills', items: skills }); }
  const edu = String(r.edu || '').trim(), certs = String(r.certs || '').trim();
  if (edu || certs) {
    out.push({ k: 'h', t: certs ? 'Education & Certificates' : 'Education' });
    if (edu) out.push({ k: 'p', t: edu });
    if (certs) out.push({ k: 'p', t: certs });
  }
  return out;
}

/* What hiring software reads: plain text, top to bottom. */
export function robotText(r) {
  const lines = [];
  for (const b of blocks(r)) {
    if (b.k === 'name' || b.k === 'title' || b.k === 'p') lines.push(b.t);
    else if (b.k === 'contact') lines.push(...b.items);
    else if (b.k === 'h') lines.push('', b.t.toUpperCase());
    else if (b.k === 'skills') lines.push(b.items.join(', '));
    else if (b.k === 'job') {
      lines.push('', b.title, b.dates);
      if (b.sub) lines.push(b.sub);
      if (b.note) lines.push(b.note);
      b.bullets.forEach((x) => lines.push('- ' + x));
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* The ready-to-send check. [label, passed] */
export function checks(r) {
  const latest = (r.work || [])[0];
  const text = robotText(r);
  const pronoun = /(^|[\s(])(i|me|my)([\s,.!?)]|$)/i.test(
    [r.summary, ...(r.work || []).flatMap((w) => w.bullets || [])].join(' '));
  return [
    ['Name, phone and email', !!(r.name && r.phone && r.email)],
    ['A strong opening line', String(r.summary || '').length >= 40],
    ['At least 3 lines for your latest work', !!latest && (latest.bullets || []).filter(Boolean).length >= 3],
    ['5 to 8 skills', (r.skills || []).length >= 5 && (r.skills || []).length <= 8],
    ['Numbers that show results', /\d/.test(text.replace(/(19|20)\d{2}|\(\d{3}\)|\d{3}-\d{4}/g, ''))],
    ['Short enough for one page', text.length < 3200],
    ['One column, robot-safe', true],
    ['No “I”, “me” or “my”', !pronoun],
  ];
}

/* Keywords from a job ad that are (or aren't) on the resume. */
export function matchKeywords(r, kws) {
  const t = robotText(r).toLowerCase();
  return (kws || []).map((k) => {
    const key = String(k).toLowerCase().trim();
    const words = key.split(/\s+/).filter((w) => w.length > 2);
    const hit = t.includes(key) || (words.length > 1 && words.every((w) => t.includes(w)));
    return { k: String(k), hit };
  });
}

/* When the AI is out: pull known skill words straight out of the ad. */
const LOCAL_KW = ['forklift', 'pallet jack', 'rf scanner', 'inventory', 'shipping', 'receiving', 'picking', 'packing',
  'safety', 'osha', 'teamwork', 'attendance', 'customer service', 'cash handling', 'cdl', 'driving record',
  'food safety', 'servsafe', 'power tools', 'blueprints', 'quality', 'machine', 'cleaning', 'scheduling',
  'microsoft office', 'excel', 'data entry', 'bilingual', 'lift 50', 'second shift', 'third shift', 'overtime'];
export function localKeywords(ad) {
  const a = String(ad || '').toLowerCase();
  return LOCAL_KW.filter((k) => a.includes(k.split(' ')[0])).slice(0, 12);
}
