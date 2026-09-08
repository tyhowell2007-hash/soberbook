import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase-server';
import {
  HELP_ANSWERS, HELP_REFUSALS, NO_MATCH, CRISIS_HANDOFF,
} from '../../../../lib/help-answers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =====================================================================
   SAGE, THE HELP DESK.  7 Sept.  The first thing in this app that talks
   to a model, and it is deliberately the least dangerous one.

   ---------------------------------------------------------------------
   ** THE ONE IDEA, AND EVERYTHING ELSE FOLLOWS FROM IT:

       THE MODEL RETURNS AN ID. IT NEVER RETURNS PROSE.

   It is shown a list of question-ids and asked which one the member
   meant. We then look that id up in help-answers.js and send back OUR
   sentence. Not one word the model writes is ever shown to a member.

   ! So the class of failure this app cannot afford -- confidently
   telling somebody to tap a menu that does not exist -- is not mitigated
   here, it is UNREACHABLE. There is no code path that puts model text on
   a screen. The worst a bad match can do is answer the wrong question,
   which the member can see is wrong and ask again.

   That is also why the whole thing runs on the cheapest model there is:
   picking one of twenty-one labels is not hard, and we are not asking it
   to be eloquent. It is a classifier wearing a chatbot's clothes.

   ---------------------------------------------------------------------
   ! THE KEY LIVES ON THE SERVER AND ONLY HERE. process.env is not
   readable from the browser unless the name starts NEXT_PUBLIC_, which
   this deliberately does not. A member's browser never sees it, never
   holds it, and cannot call Anthropic directly with our credit.

   ! WHAT WE SEND THEM: the member's question, and nothing else. No
   handle, no id, no email, no day count, no session. Anthropic could not
   identify who asked if they wanted to. Their Commercial Terms (B, read
   7 Sept) say "Anthropic may not train models on Customer Content from
   Services", which is why the privacy page is allowed to say so too.
   ===================================================================== */

/* 🔴 CRISIS IS CHECKED FIRST, IN THIS FILE, AND NEVER BY THE MODEL.

   Two reasons and both are load-bearing. It must not depend on a network
   call that can time out, rate-limit, or run out of credit -- the one
   moment this has to work is the moment everything else is allowed to
   fail. And a local test is inspectable: you can read exactly what it
   catches, which you cannot do with a model's judgement.

   ⚠️ Deliberately over-broad. A false positive costs somebody an
   unnecessary sight of the 988 number on a page about changing their
   handle. A false negative is a person in trouble being handed a menu
   path. Those are not comparable, so the threshold is not set in the
   middle. */
/* 🔴🔴 THE STEMS HAVE NO TRAILING \b AND THAT IS NOT A TYPO.

   The first version was one group wrapped in \b(...)\b and it MISSED
   "thinking about suicide" and "thinking about an overdose" -- because
   \bsuicid\b cannot match inside "suicide": there is no word boundary
   between the d and the e. It looked completely right and failed on the
   two most ordinary phrasings in the whole list.

   ⚠️ THIRD TIME IN THIS WORKSPACE. On 2 Sept `\b14[- ]?min\b` reported a
   page CLEAN that said "14-minute", and the only reason it was caught
   was a control. Same today. **A stem gets a leading boundary only.**

   So: whole phrases in the first group, stems in the second. */
const CRISIS = new RegExp(
  '\\b(kill (myself|me)|end (it|my life)|take my own life|wants? to die'
  + '|wanna die|better off dead|hurt myself|harm myself|cut myself'
  + '|not worth living|no reason to live)\\b'
  + '|\\b(suicid|overdos|self.?harm)',
  'i',
);

const CATALOGUE = [...HELP_ANSWERS, ...HELP_REFUSALS];
const BY_ID = Object.fromEntries(CATALOGUE.map((e) => [e.id, e]));

/* What the model is shown. ! The `say` text is NOT included -- it does
   not need it to choose, and leaving it out keeps the request small,
   cheap, and free of anything it could be tempted to paraphrase. */
const MENU = CATALOGUE
  .map((e) => `${e.id}: ${e.ask.join(' / ')}`)
  .join('\n');

const SYSTEM =
  'You match a question to one label. Reply with the label id alone, ' +
  'nothing else. If none of them is what the person meant, reply NONE. ' +
  'Never write a sentence. Never explain.\n\n' + MENU;

export async function POST(req) {
  /* Members only. ⚠️ Not because the answers are secret -- they describe
     a menu -- but because an open endpoint that spends money is a bill
     anyone on the internet can run up for us. */
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = null; }
  const q = String(body?.q || '').trim();

  if (q.length < 2) return NextResponse.json({ say: NO_MATCH, id: 'empty' });

  /* ⚠️ A hard cap, before anything is spent. Nobody types 400 characters
     to ask where the sign-out button is, and the length of the request is
     the only part of the cost we control from here. */
  if (q.length > 400) {
    return NextResponse.json({
      say: 'That is a long one — try it in a sentence, or write to hello@soberbook.app.',
      id: 'toolong',
    });
  }

  /* 🔴 Before the model, before anything. */
  if (CRISIS.test(q)) {
    return NextResponse.json({ ...CRISIS_HANDOFF, id: 'crisis' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  /* ⚠️ FAILS SOFT, and says something true while doing it. A missing key
     is our problem, not the member's, and "try once more" would be a lie
     -- trying again cannot help. */
  if (!key) return NextResponse.json({ say: NO_MATCH, id: 'nokey' });

  let picked = 'NONE';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 12,          // an id is a few tokens. This is the ceiling per call.
        temperature: 0,          // the same question should get the same answer twice
        system: SYSTEM,
        messages: [{ role: 'user', content: q }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = await r.json();
      picked = String(j?.content?.[0]?.text || 'NONE').trim();
    }
  } catch {
    /* Timeout, network, quota, anything. Falls through to NO_MATCH. */
  }

  /* !! THE LOOKUP IS THE WHOLE SAFETY PROPERTY. If the model returns a
     label we do not have -- a hallucinated id, a sentence, an apology --
     BY_ID misses and the member gets the honest fallback. There is no
     branch in which its text is passed along. */
  const hit = BY_ID[picked];
  if (!hit) return NextResponse.json({ say: NO_MATCH, id: 'nomatch' });

  return NextResponse.json({ say: hit.say, go: hit.go || null, id: hit.id });
}
