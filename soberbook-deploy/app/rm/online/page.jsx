import { lang } from '../../../lib/rm/server';

export const metadata = { title: 'Online care', description: 'Telehealth treatment for opioids and alcohol you can start from your phone, plus apps and communities, labeled for what they are.' };

/* Re-checked 31 Oct 2026. Removed: Tempest (bought by Monument in 2022,
   site no longer loads), Lionrock (now redirects to Brightside), Sober Mom
   Squad and SOS (addresses came back "not found"). Sunnyside relabeled:
   it's a coaching app, not a clinic. No company pays to be on this page. */
const G = [
  ['Medication for opioids, by video', [
    ['Bicycle Health', 'Suboxone and therapy by video, all 50 states, most insurance.', 'https://www.bicyclehealth.com'],
    ['Boulder Care', 'Opioid and alcohol care; Medicaid in the states it covers.', 'https://www.boulder.care'],
    ['Ophelia', 'Private, at-home Suboxone treatment in 30+ states.', 'https://ophelia.com'],
    ['Workit Health', 'Opioid and alcohol care with an app-based program.', 'https://www.workithealth.com'],
  ]],
  ['Medication for alcohol', [
    ['Monument', 'Naltrexone and therapy for alcohol. Now includes the former Tempest community.', 'https://joinmonument.com'],
    ['Ria Health', 'App-based alcohol treatment with medical providers.', 'https://riahealth.com'],
    ['Oar Health', 'Naltrexone by prescription, for cutting back or quitting.', 'https://www.oarhealth.com'],
  ]],
  ['Mental health and co-occurring care', [
    ['Charlie Health', 'Virtual intensive outpatient for teens, young adults and adults.', 'https://www.charliehealth.com'],
    ['Eleanor Health', 'Addiction and mental health care, virtual and in person.', 'https://www.eleanorhealth.com'],
  ]],
  ['Apps and communities (not medical treatment)', [
    ['Sunnyside', 'A coaching app for drinking less. No doctors, no medication.', 'https://www.sunnyside.co'],
    ['Sober Book', 'A free social network for people in recovery, every path.', 'https://soberbook.app'],
  ]],
];
export default function Online() {
  const es = lang() === 'es';
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}><div className="eyebrow">{es ? 'Atención en línea · revisado el 31 de oct. de 2026' : 'Online care · re-checked Oct 31, 2026'}</div><h1>{es ? 'Empiece desde su teléfono' : 'Start from your phone'}</h1>
        <p className="lede">{es ? 'Telemedicina con licencia, y algunas apps y comunidades, etiquetadas por lo que son. Ninguna empresa paga por aparecer.' : 'Licensed telehealth, plus a few apps and communities, labeled for what they are. No company pays to be on this page. Coverage changes by state and plan, so check each one.'}</p></div>
      {G.map(([h, items]) => (
        <section key={h} className="list"><h2>{h}</h2>
          {items.map(([n, d, u]) => <div className="item" key={n}><div><b>{n}</b><p>{d}</p></div><a className="btn ghost sm" href={u} target="_blank" rel="noopener noreferrer">{es ? 'Visitar' : 'Visit'}</a></div>)}
        </section>
      ))}
    </div>
  );
}
