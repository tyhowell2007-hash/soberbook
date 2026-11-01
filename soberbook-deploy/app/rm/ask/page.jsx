import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';

export const metadata = { title: 'Ask the Doc', description: 'Answers to the questions families ask most, from addiction physician Dr. Nicole Labor, DO.' };

/* ⚠️ DRAFT ANSWERS. Written for Dr. Labor to rewrite in her own voice.
   The page says so until CONTENT_APPROVED is flipped. */
const Q = [
  ['Is medication just trading one drug for another?', 'No. Medications like buprenorphine and methadone treat the disease, lower the risk of dying from an overdose, and let people get their lives back. Medication counts as recovery.'],
  ['How do I know which kind of treatment someone needs?', 'Start with an assessment at any outpatient clinic, or use the three-question guide on this site. A good program will tell you if you need more or less care than they offer.'],
  ['Do I need to go to detox first?', 'Not always. Alcohol and some pills can be dangerous to stop suddenly, so ask a doctor. Detox is a first step, never the whole treatment.'],
  ['What if they relapse?', 'Relapse is common in a chronic illness and it doesn’t mean treatment failed. It means the plan needs to change. Keep Narcan close.'],
  ['Can I make an adult go to treatment?', 'Usually not, and pressure alone rarely works. Stay connected, keep your list ready, and get support for yourself too.'],
  ['How much does treatment cost?', 'It ranges from free to very expensive. Medicaid covers most treatment, and many programs charge on a sliding scale. Always ask.'],
  ['Are these programs any good?', 'Listings come from the government’s directory, and that isn’t a rating. A gold badge means I checked that place myself. Call and ask hard questions.'],
  ['Is what I search here private?', 'Yes. We don’t track you or sell anything, and Quick exit gets you off the page fast.'],
];
export default function Ask() {
  const L = lang();
  return (
    <div className="page">
      <div className="about" style={{ gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)' }}>
        <img className="big" src="/rm/drlabor.jpg" alt="Dr. Nicole Labor" width="560" height="560" />
        <div style={{ display: 'grid', gap: 10, alignContent: 'center' }}><div className="eyebrow">Ask the Doc</div><h1>The questions families ask most</h1>
          {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}</div>
      </div>
      <div className="faq">{Q.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </div>
  );
}
