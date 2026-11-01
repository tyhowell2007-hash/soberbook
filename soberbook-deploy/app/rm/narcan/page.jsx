import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';

export const metadata = { title: 'Narcan: how to get it and use it', description: 'Narcan (naloxone) reverses an opioid overdose. How to use it in five steps, and where to get it free.' };

/* 🔴 The one page on the site that can keep somebody alive today.
   Steps are standard naloxone guidance; Dr. Labor reviews the wording
   before launch (CONTENT_APPROVED). */
const W = {
  en: { eye: 'Narcan (naloxone)', h: 'It reverses an opioid overdose. Anyone can use it.',
    lede: 'Narcan nasal spray is sold without a prescription at most pharmacies, and in Ohio you can get it free through Project DAWN. It can’t hurt someone who isn’t overdosing.',
    steps: [['Check', 'Shout their name and rub hard on the breastbone. Look for slow or no breathing, blue lips, no response.'],
      ['Call 911', 'Say “someone isn’t breathing.” Ohio and most states give some legal protection to people who call 911 for an overdose; the details vary.'],
      ['Spray', 'Tip the head back, put the nozzle in one nostril, and press the plunger all the way.'],
      ['Breathe and turn', 'Give rescue breaths if you know how. Otherwise roll them onto their side so they don’t choke.'],
      ['Stay', 'If there’s no response in 2 to 3 minutes, give a second dose. Narcan can wear off before the drugs do, so stay until help comes.']],
    od: 'Overdose?', call: 'Call 911', then: 'Then use Narcan. Then stay.',
    get: 'Get Narcan free', g1: 'Project DAWN (Ohio): free kits and training at local health departments and partner sites. Call your county health department and ask for Project DAWN.',
    g2: 'By mail: NEXT Distro mails naloxone free in many states.', g3: 'Any pharmacy: ask for Narcan or naloxone. No prescription needed.' },
  es: { eye: 'Narcan (naloxona)', h: 'Revierte una sobredosis de opioides. Cualquiera puede usarlo.',
    lede: 'El aerosol nasal Narcan se vende sin receta en la mayoría de las farmacias, y en Ohio puede conseguirlo gratis con Project DAWN. No le hace daño a alguien que no tiene una sobredosis.',
    steps: [['Revise', 'Grite su nombre y frote fuerte el pecho. Busque respiración lenta o ausente, labios azules, falta de respuesta.'],
      ['Llame al 911', 'Diga “alguien no está respirando.” Ohio y la mayoría de los estados ofrecen cierta protección legal a quien llama al 911 por una sobredosis; los detalles varían.'],
      ['Rocíe', 'Incline la cabeza hacia atrás, ponga la boquilla en una fosa nasal y presione el émbolo hasta el fondo.'],
      ['Respire y voltee', 'Dé respiraciones de rescate si sabe cómo. Si no, póngalo de lado para que no se ahogue.'],
      ['Quédese', 'Si no responde en 2 a 3 minutos, dé una segunda dosis. Narcan puede pasar antes que las drogas, así que quédese hasta que llegue ayuda.']],
    od: '¿Sobredosis?', call: 'Llame al 911', then: 'Luego use Narcan. Luego quédese.',
    get: 'Consiga Narcan gratis', g1: 'Project DAWN (Ohio): kits y capacitación gratis en departamentos de salud locales. Llame al departamento de salud de su condado y pregunte por Project DAWN.',
    g2: 'Por correo: NEXT Distro envía naloxona gratis en muchos estados.', g3: 'Cualquier farmacia: pida Narcan o naloxona. No necesita receta.' },
};

export default function Narcan() {
  const L = lang(), w = W[L];
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="eyebrow" style={{ color: 'var(--crisis)' }}>{w.eye}</div><h1>{w.h}</h1><p className="lede">{w.lede}</p>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}
      </div>
      <div className="detail">
        <div><ol className="steps">{w.steps.map(([a, b]) => <li key={a}><div><b>{a}</b><p>{b}</p></div></li>)}</ol></div>
        <aside>
          <a className="callbox" href="tel:911" style={{ background: 'var(--crisis)', color: 'var(--crisis-ink)', textDecoration: 'none' }}><span className="small">{w.od}</span><span className="num" style={{ color: 'var(--crisis-ink)' }}>{w.call}</span><span className="small">{w.then}</span></a>
          <div className="card"><h3>{w.get}</h3><p>{w.g1}</p><p>{w.g2} <a href="https://nextdistro.org" target="_blank" rel="noopener noreferrer">nextdistro.org</a></p><p>{w.g3}</p></div>
        </aside>
      </div>
    </div>
  );
}
