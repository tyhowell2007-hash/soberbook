import { redirect, notFound } from 'next/navigation';
import { serverClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE SURVEY ANSWERS. Ty only.

   ⚠️ 404, not "you're not allowed" — same call as /admin and
   /admin/numbers. A polite refusal confirms the route is real.

   And as on those: this check is a convenience over a locked door, not
   the lock. survey_counts() and survey_text() each run their own admin
   check inside themselves, because they are SECURITY DEFINER and those
   bypass RLS entirely. Delete this file and the answers are still safe.

   🔴 THERE IS NO "WHO SAID THIS" COLUMN TO RENDER, because there is no
   such column in the table. If somebody ever asks to see who wrote a
   given answer, that is a schema change and it should feel like one.
   ===================================================================== */

const LABEL = {
  someone_told_me: 'Someone told me',
  facebook: 'Facebook',
  poster: 'A poster or flyer',
  meetings: 'Looking for meetings',
  people_who_get_it: 'People who get it',
  curious: 'Just curious',
  say_hi: 'Somewhere to just say hi',
  who_can_see: 'Knowing who can see what I write',
  a_prompt: 'A prompt or a question to answer',
  more_talking: 'Seeing more people talking first',
  more_time: "More time — just haven't got to it",
  yes: 'Yes, I have posted',
  no: 'Not yet',
  responses: 'Responses',
};

const KINDS = {
  one_thing: 'Anything you’d add',
  first_time: 'What made you the first time',
  found_us_other: 'How they found us — other',
  stopped_other: 'What would help — other',
};

export default async function AdminSurveyPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: mod } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!mod?.is_admin) notFound();

  const { data: counts } = await supabase.rpc('survey_counts');
  const { data: text }   = await supabase.rpc('survey_text');

  const rows   = counts || [];
  const total  = rows.find(r => r.question === 'total')?.n || 0;
  const group  = q => rows.filter(r => r.question === q).sort((a, b) => b.n - a.n);
  const bar    = n => (total ? Math.round((n / total) * 100) : 0);

  const Section = ({ title, data }) => (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em',
                   color: '#63716A', margin: '0 0 12px', fontWeight: 650 }}>{title}</h2>
      {data.length === 0
        ? <p style={{ fontSize: 14, color: '#63716A', margin: 0 }}>Nothing yet.</p>
        : data.map(r => (
          <div key={r.answer} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: 14.5, marginBottom: 4, color: '#1C2320' }}>
              <span>{LABEL[r.answer] || r.answer}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#63716A' }}>
                {r.n} · {bar(r.n)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#E8F4ED', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${bar(r.n)}%`,
                            background: '#1B6B4A', borderRadius: 99 }} />
            </div>
          </div>
        ))}
    </section>
  );

  return (
    <main style={{ maxWidth: 620, margin: '0 auto', padding: '24px 16px 60px',
                   fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1C2320' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Survey</h1>
      <p style={{ fontSize: 14, color: '#63716A', margin: '0 0 6px' }}>
        {total} {total === 1 ? 'response' : 'responses'}.
      </p>
      <p style={{ fontSize: 12.5, color: '#63716A', margin: '0 0 28px', lineHeight: 1.5 }}>
        Answers aren&rsquo;t linked to members — there is no name to show, by design.
        Free text is in a shuffled order for the same reason.
      </p>

      <Section title="What brought them here" data={group('found_us')} />
      <Section title="Have they posted yet" data={group('has_posted')} />
      <Section title="What would make it easier" data={group('stopped_by')} />

      <section>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em',
                     color: '#63716A', margin: '0 0 12px', fontWeight: 650 }}>
          In their own words
        </h2>
        {(!text || text.length === 0)
          ? <p style={{ fontSize: 14, color: '#63716A' }}>Nothing yet.</p>
          : text.map((t, i) => (
            <div key={i} style={{ border: '1px solid #DCE7E1', borderRadius: 10,
                                  padding: '13px 15px', marginBottom: 10, background: '#fff' }}>
              <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em',
                            color: '#63716A', marginBottom: 6 }}>
                {KINDS[t.kind] || t.kind} · {t.answered_on}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.body}</div>
            </div>
          ))}
      </section>
    </main>
  );
}
