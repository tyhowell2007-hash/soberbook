import { base, lang } from '../../lib/rm/server';
import { t } from '../../lib/rm/t';
import { CONTENT_APPROVED } from '../../lib/rm/words';
import NearMe from './NearMe';

export const dynamic = 'force-dynamic';

/* RecoveryMap home. Search first: the shortest path from arriving to a
   list of places to call. No promises, guarantees or time estimates in
   the copy (Kenny, 6 Nov 2026). */
export default async function Home() {
  const b = base(), L = lang(), es = L === 'es';

  return (
    <div className="page">
      <section className="hero solo">
        <div className="copy">
          <div className="eyebrow">{t('free_line', L)}</div>
          <h1>{t('hero1', L)}</h1>
          <p className="lede">{t('hero2', L)}</p>
          <form className="search" action={`${b}/search`} method="get" role="search">
            <input name="near" placeholder={t('near_ph', L)} aria-label={t('near_ph', L)} autoComplete="postal-code" />
            <NearMe action={`${b}/search`} label={t('near_me', L)} />
            <button className="rm-btn" type="submit">{t('find', L)}</button>
          </form>
          <a href={`${b}/guide`} style={{ fontWeight: 700 }}>{t('not_sure', L)}</a>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <h2>{es ? '¿Por dónde quiere empezar?' : 'Where do you want to start?'}</h2>
        <div className="paths">
          <a className="path" href={`${b}/search`}><h3>{es ? 'Tratamiento cerca de usted' : 'Treatment near you'}</h3><p>{es ? 'Programas para drogas, alcohol y salud mental.' : 'Programs for drugs, alcohol and mental health.'}</p></a>
          <a className="path" href={`${b}/housing`}><h3>{es ? 'Vivienda de recuperación' : 'Recovery housing'}</h3><p>{es ? 'Vivienda sobria cerca de usted, y cómo encontrar una Oxford House.' : 'Sober living near you, and how to find an Oxford House.'}</p></a>
          <a className="path" href={`${b}/online`}><h3>{es ? 'Empiece desde su teléfono' : 'Start from your phone'}</h3><p>{es ? 'Telemedicina para opioides y alcohol.' : 'Telehealth for opioids and alcohol.'}</p></a>
          <a className="path" href={`${b}/meetings`}><h3>{es ? 'Reuniones gratuitas' : 'Free meetings'}</h3><p>{es ? 'AA, NA, SMART, Recovery Dharma y más.' : 'AA, NA, SMART, Recovery Dharma, Celebrate Recovery and more.'}</p></a>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2>{es ? 'Empiece aquí si usted es…' : 'Start here if you’re…'}</h2>
        <div className="quick">
          <a href={`${b}/for-you#family`}>{es ? 'Alguien preocupado por un ser querido' : 'Worried about someone I love'}</a>
          <a href={`${b}/for-you#teens`}>{es ? 'Adolescente o adulto joven' : 'A teen or young adult'}</a>
          <a href={`${b}/for-you#moms`}>{es ? 'Embarazada o mamá reciente' : 'Pregnant or a new mom'}</a>
          <a href={`${b}/for-you#veterans`}>{es ? 'Veterano' : 'A veteran'}</a>
          <a href={`${b}/for-you#reentry`}>{es ? 'Saliendo de la cárcel' : 'Leaving jail or prison'}</a>
          <a href={`${b}/no-insurance`}>{es ? 'Sin seguro' : 'Without insurance'}</a>
        </div>
      </section>

      <div className="banner"><div style={{ display: 'grid', gap: 4 }}><b>{es ? 'Lleve Narcan. Es gratis y salva vidas.' : 'Carry Narcan. It’s free, and it saves lives.'}</b><span>{es ? 'Dónde conseguirlo y cómo usarlo en 30 segundos.' : 'Where to get it, and how to use it in 30 seconds.'}</span></div><a className="rm-btn" href={`${b}/narcan`}>Narcan</a></div>

      <section style={{ display: 'grid', gap: 14 }}>
        <h2>{es ? 'Qué significan las palabras' : 'What the words mean'}</h2>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}
        <div className="levels">
          <div className="lvl"><b>{es ? 'Desintoxicación' : 'Detox'}</b><p>{es ? 'Atención médica mientras su cuerpo deja una droga. Es el primer paso, no todo el tratamiento.' : 'Medical care while your body comes off a drug. A first step, not the whole treatment.'}</p></div>
          <div className="lvl"><b>{es ? 'Tratamiento residencial' : 'Live-in treatment'}</b><p>{es ? 'Usted vive allí durante el tratamiento.' : 'You live there during treatment. Also called residential or inpatient.'}</p></div>
          <div className="lvl"><b>{es ? 'Tratamiento de día' : 'Day treatment'}</b><p>{es ? 'Gran parte del día, y en la noche a casa.' : 'Treatment for much of the day, then home at night. Also called PHP.'}</p></div>
          <div className="lvl"><b>{es ? 'Ambulatorio intensivo' : 'Intensive outpatient'}</b><p>{es ? 'Varias horas al día, varios días a la semana.' : 'Several hours a day, several days a week. Also called IOP.'}</p></div>
          <div className="lvl"><b>{es ? 'Medicamentos (MAT)' : 'Medication (MAT)'}</b><p>{es ? 'Suboxone, metadona, Vivitrol y otros. Los medicamentos cuentan como recuperación.' : 'Suboxone, methadone, Vivitrol and others. Medication counts as recovery.'}</p></div>
          <div className="lvl"><b>{es ? 'Vivienda de recuperación' : 'Recovery housing'}</b><p>{es ? 'Un lugar sobrio para vivir mientras se reconstruye. No es tratamiento.' : 'A sober place to live while you rebuild. Not treatment itself.'}</p></div>
        </div>
      </section>

      <div className="grid2">
        <div className="card lav"><h3>{es ? '¿Busca ayuda para alguien que ama?' : 'Looking for someone you love?'}</h3><p>{es ? 'Busque de la misma manera y, si pueden, llamen juntos.' : 'Search the same way, then call together if you can.'}</p><a className="rm-btn sm" href={`${b}/for-you#family`}>{es ? 'Empiece aquí' : 'Start here'}</a></div>
        <div className="card teal"><h3>{es ? '¿Toma medicamentos? Usted es bienvenido.' : 'On medication? You belong here.'}</h3><p>{es ? 'Suboxone, metadona y Vivitrol cuentan como recuperación.' : 'Suboxone, methadone and Vivitrol count as recovery. Filter for programs and houses that welcome it.'}</p><a className="rm-btn teal sm" href={`${b}/search?near=&level=medication_assisted`}>{es ? 'Programas con medicamentos' : 'Programs with medication'}</a></div>
      </div>

      <div className="sbk"><b>{es ? '¿Necesita personas, no solo un programa?' : 'Need people, not just a program?'}</b><p>{es ? 'Sober Book es una red social gratuita para personas en recuperación.' : 'Sober Book is a free social network for people in recovery.'}</p><a className="rm-btn sm" href="https://soberbook.app">{es ? 'Únase a Sober Book' : 'Join Sober Book'}</a></div>

    </div>
  );
}
