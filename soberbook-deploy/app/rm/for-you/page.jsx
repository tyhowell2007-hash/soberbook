import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';

export const metadata = { title: 'Start here', description: 'Starting points for families, teens, pregnant and new moms, veterans, people leaving jail, and people without insurance.' };

export default function ForYou() {
  const b = base(), L = lang();
  const C = [
    ['family', 'Worried about someone you love', ['You can’t force an adult into treatment, but you can have a list ready for the moment they say yes.', 'Keep Narcan in the house if opioids are involved.', 'Al-Anon and Nar-Anon are free meetings for family.'], `${b}/meetings`, 'Family meetings'],
    ['teens', 'Teens and young adults', ['Look for “Program for teens” or “young adults” on a listing.', 'In Ohio, teens can agree to some addiction treatment on their own. Rules differ by state, so ask the program.', '988 takes calls and texts from teens too.'], `${b}/search?prog=adolescent`, 'Programs for teens'],
    ['moms', 'Pregnant or a new mom', ['Programs that take federal treatment money must give pregnant women priority for admission.', 'Medication like buprenorphine or methadone is recommended in pregnancy for opioid use. Ask your doctor.', 'Look for “Program for pregnant & new moms.”'], `${b}/search?prog=pregnant_postpartum`, 'Programs for moms'],
    ['veterans', 'Veterans', ['Veterans Crisis Line: dial 988, then press 1.', 'VA clinics offer outpatient treatment and medication. Search near you.', 'Look for “Program for veterans.”'], `${b}/search?prog=veterans`, 'Programs for veterans'],
    ['reentry', 'Leaving jail or prison', ['Tolerance drops fast inside. The first weeks out carry the highest overdose risk. Carry Narcan.', 'Ask before release about restarting Medicaid and medication.', 'Some programs serve people coming from court or jail. Call and ask.'], `${b}/narcan`, 'Get Narcan'],
    ['money', 'Without insurance', ['Many places charge by what you can pay.', 'State and federal money pays for treatment at a lot of programs.', 'You may qualify for Medicaid right now.'], `${b}/no-insurance`, 'Start here'],
  ];
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}><div className="eyebrow">Start here for…</div><h1>Help that starts where you are</h1>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}</div>
      <div className="grid2">{C.map(([id, h, tips, href, cta]) => (
        <div className="card" id={id} key={id}><h3>{h}</h3><ul className="ask">{tips.map((x) => <li key={x}>{x}</li>)}</ul><a className="btn sm" href={href}>{cta}</a></div>
      ))}</div>
    </div>
  );
}
