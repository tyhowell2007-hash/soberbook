import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';

/* =====================================================================
   📝 THE RESUME HELPER — 9 Nov 2026 (0205).  POST { mode, ... }

     polish  { text, title }  → { lines: [..] }  "Make it professional"
     match   { ad }           → { keywords: [..] } words a job ad asks for
     read    { file:{type,b64} } → { resume: {...} } fill from an old resume

   🔴 NEVER ADDS ANYTHING. Every prompt says: only what the person wrote
      or what is on the page. No numbers, tools or results they didn't
      give. The whole promise of this builder is that it doesn't lie for
      you — the other sites' AI got caught doing exactly that.
   🔴 SIGNED IN ONLY, and resume_ai_ok() caps it at 40 calls a day.
   ⚠️ Nothing sent here is stored. The resume itself is saved by the page
      through save_resume(), never by this route.
   ===================================================================== */

const MODEL = 'claude-haiku-4-5-20251001';

const POLISH = `You turn a person's own plain description of a job into resume bullet points.
Rules:
- Use ONLY facts the person stated. Never add numbers, tools, duties, results or skills they did not mention.
- Start each line with a past-tense action verb. No "I", "me" or "my".
- Each line under 14 words, plain American English, no fancy jargon.
- 2 to 5 lines. If nothing usable was written, return [].
Reply with a JSON array of strings and nothing else.`;

const MATCH = `From this job posting, list 8 to 12 short keywords or phrases a hiring system would scan for: skills, tools, certifications, physical requirements and shift needs.
Each 1 to 4 words, lowercase. No company names, no pay, no benefits.
Reply with a JSON array of strings and nothing else.`;

const READ = `Read this resume and copy what it says into JSON with exactly these keys:
{"name":"","town":"","phone":"","email":"","target":"","summary":"","work":[{"title":"","where":"","town":"","from":"","to":"","bullets":[""]}],"skills":[""],"edu":"","certs":""}
Rules:
- Copy facts exactly as written. Never invent or improve anything.
- "town" is city and state only. Leave out any street address.
- "from" and "to" are as written (for example "2021" or "March 2021"); use "" for a current job's end.
- Most recent job first. Up to 6 jobs and 6 bullets each.
- "edu" and "certs" are each one short line.
- Use "" or [] when something isn't there.
Reply with the JSON object and nothing else.`;

function firstJson(s, open) {
  const close = open === '[' ? ']' : '}';
  const a = s.indexOf(open), b = s.lastIndexOf(close);
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

async function ask(key, system, content, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.content || []).map((c) => c.text || '').join('');
}

const strs = (a, n, len) => (Array.isArray(a) ? a : [])
  .map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, n).map((x) => x.slice(0, len));

export async function POST(req) {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const mode = String(body?.mode || '');
  if (!['polish', 'match', 'read'].includes(mode)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'The helper is resting. Try again later.' }, { status: 503 });

  const { data: ok, error } = await supabase.rpc('resume_ai_ok');
  if (error || ok !== true) {
    return NextResponse.json({ error: 'That’s a lot of help for one day. The helper is back tomorrow.' }, { status: 429 });
  }

  try {
    if (mode === 'polish') {
      const text = String(body.text || '').slice(0, 1500).trim();
      if (text.length < 3) return NextResponse.json({ lines: [] });
      const title = String(body.title || '').slice(0, 80);
      const out = await ask(key, POLISH, `Job title: ${title || 'not given'}\nWhat they did, in their words:\n${text}`, 400);
      return NextResponse.json({ lines: strs(firstJson(out || '', '['), 5, 140) });
    }

    if (mode === 'match') {
      const ad = String(body.ad || '').slice(0, 6000).trim();
      if (ad.length < 20) return NextResponse.json({ keywords: [] });
      const out = await ask(key, MATCH, ad, 300);
      return NextResponse.json({ keywords: strs(firstJson(out || '', '['), 12, 40).map((k) => k.toLowerCase()) });
    }

    // read an old resume (PDF or a photo of one)
    const f = body.file || {};
    const type = String(f.type || '');
    const b64 = String(f.b64 || '');
    if (!b64 || b64.length > 4_000_000) return NextResponse.json({ error: 'That file is too big. Try a PDF or a photo under 3 MB.' }, { status: 400 });
    let part;
    if (type === 'application/pdf') part = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
    else if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) part = { type: 'image', source: { type: 'base64', media_type: type, data: b64 } };
    else return NextResponse.json({ error: 'Use a PDF or a photo (JPG or PNG).' }, { status: 400 });

    const out = await ask(key, READ, [part, { type: 'text', text: 'Copy this resume into the JSON.' }], 2500);
    const j = firstJson(out || '', '{');
    if (!j) return NextResponse.json({ error: 'Couldn’t read that one. Try a clearer photo or the PDF.' }, { status: 422 });
    const s = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const resume = {
      name: s(j.name, 80), town: s(j.town, 80), phone: s(j.phone, 30), email: s(j.email, 120),
      target: s(j.target, 80), summary: s(j.summary, 600),
      work: (Array.isArray(j.work) ? j.work : []).slice(0, 6).map((w) => ({
        title: s(w?.title, 80), where: s(w?.where, 120), town: s(w?.town, 80),
        from: s(w?.from, 20), to: s(w?.to, 20), bullets: strs(w?.bullets, 6, 160),
      })),
      skills: strs(j.skills, 12, 40), edu: s(j.edu, 160), certs: s(j.certs, 160),
    };
    return NextResponse.json({ resume });
  } catch {
    return NextResponse.json({ error: 'The helper didn’t answer. Try again in a minute.' }, { status: 502 });
  }
}
