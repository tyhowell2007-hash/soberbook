import { base, lang, db } from '../../lib/rm/server';
import { t } from '../../lib/rm/t';
import { CONTENT_APPROVED, HELP, helpKind, cleanName, placePath } from '../../lib/rm/words';
import NearMe from './NearMe';

export const dynamic = 'force-dynamic';

/* RecoveryMap home. Her face and name first — on the old site her name
   and DO appeared NOWHERE, just "by TheAddictsDoc". */
export default async function Home() {
  const b = base(), L = lang(), es = L === 'es';
  const { data: picks } = await db().rpc('rm_picks');

  return (
    <div className="page">
      <section className="hero">
        <div className="copy">
          <div className="eyebrow">{t('free_line', L)}</div>
          <h1>{t('hero1', L)}<br /><span dangerouslySetInnerHTML={{ __html: t('hero2', L) }} /></h1>
          <div className="byline"><span className="hand">Dr. Nicole Labor</span><span className="small">{t('cred_line', L)}</span></div>
          <form className="search" action={`${b}/search`} method="get" role="search">
            <input name="near" placeholder={t('near_ph', L)} aria-label={t('near_ph', L)} autoComplete="postal-code" />
            <NearMe action={`${b}/search`} label={t('near_me', L)} />
            <button className="rm-btn" type="submit">{t('find', L)}</button>
          </form>
          <a href={`${b}/guide`} style={{ fontWeight: 700 }}>{t('not_sure', L)}</a>
        </div>
        <div className="portrait">
          <img src="/rm/drlabor.jpg" alt="Dr. Nicole Labor" width="560" height="560" />
          <div className="tag"><b>Dr. Nicole Labor, DO</b><span className="small">{es ? 'Certificada en Medicina Familiar y Medicina de Adicciones' : 'Board-certified in Family Medicine and Addiction Medicine'}</span></div>
        </div>
      </section>

      <div className="creds">
        <div className="cred"><b>{es ? 'Medicina de adicciones' : 'Addiction Medicine'}</b><span>{es ? 'Certificada desde 2013; Medicina Familiar desde 2010' : 'Board-certified since 2013, Family Medicine since 2010'}</span></div>
        <div className="cred"><b>FASAM</b><span>{es ? 'Miembro de la Sociedad Americana de Medicina de Adicciones' : 'Fellow of the American Society of Addiction Medicine'}</span></div>
        <div className="cred"><b>{es ? 'Directora médica' : 'Medical director'}</b><span>{es ? 'Programas de tratamiento de adicciones en Ohio y Pensilvania' : 'Addiction treatment programs in Ohio and Pennsylvania'}</span></div>
        <div className="cred"><b>{es ? 'Lo ha vivido' : 'Been there'}</b><span>{es ? 'En recuperación desde 2005, y lo dice abiertamente' : 'In recovery since 2005, and open about it'}</span></div>
      </div>

      <section style={{ display: 'grid', gap: 14 }}>
        <h2>{es ? '¿Por dónde quiere empezar?' : 'Where do you want to start?'}</h2>
        <div className="paths">
          <a className="path" href={`${b}/search`}><h3>{es ? 'Tratamiento cerca de usted' : 'Treatment near you'}</h3><p>{es ? '12,916 programas para drogas y alcohol, y 6,574 de salud mental.' : '12,916 programs for drugs and alcohol, and 6,574 for mental health.'}</p></a>
          <a className="path" href={`${b}/housing`}><h3>{es ? 'Vivienda de recuperación' : 'Recovery housing'}</h3><p>{es ? 'Vivienda sobria cerca de usted, y cómo encontrar una Oxford House.' : 'Sober living near you, and how to find an Oxford House.'}</p></a>
          <a className="path" href={`${b}/online`}><h3>{es ? 'Empiece desde su teléfono' : 'Start from your phone'}</h3><p>{es ? 'Telemedicina para opioides y alcohol.' : 'Telehealth for opioids and alcohol, re-checked every month.'}</p></a>
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

      <div className="quote">
        <img src="/rm/wordmark.jpg" alt="The Addicts Doc" width="520" height="69" />
        <div style={{ display: 'grid', gap: 8 }}><p className="q">“We’re not just recovering, we’re reconstructing.”</p><p className="small">Dr. Nicole Labor, theaddictsdoc.com</p></div>
      </div>

      {picks?.length ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 4 }}><h2>{es ? 'Recomendados por la Dra. Labor' : 'Dr. Labor’s picks'}</h2><p className="lede">{es ? 'Programas que ella revisó personalmente.' : 'Programs she has personally checked, with a note in her own words.'}</p></div>
          <div className="grid3">
            {picks.map((p) => { const n = cleanName(p.name); return (
              <a key={p.slug} className="card" href={b + placePath(p)} style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="vb"><i>✓</i>{t('checked_by', L)}</span>
                <h3>{n.name}</h3><p className="small">{p.city}, {p.state} · {HELP[L][helpKind(p.services)]}</p>
                {p.note && <p style={{ background: 'var(--lav-pale)', borderRadius: 12, padding: '10px 12px', fontSize: 15 }}><span className="hand" style={{ color: 'var(--lav)' }}>Dr. L:</span> {p.note}</p>}
              </a>); })}
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 14 }}>
        <h2>{es ? 'Qué significan las palabras' : 'What the words mean'}</h2>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}
        <div className="levels">
          <div className="lvl"><b>{es ? 'Desintoxicación' : 'Detox'}</b><p>{es ? 'Atención médica mientras su cuerpo deja una droga, normalmente unos días. Es el primer paso, no todo el tratamiento.' : 'Medical care while your body comes off a drug, usually a few days. The first step for some, not the whole treatment.'}</p></div>
          <div className="lvl"><b>{es ? 'Tratamiento residencial' : 'Live-in treatment'}</b><p>{es ? 'Usted se queda allí, a menudo semanas.' : 'You stay there, often weeks. Also called residential or inpatient.'}</p></div>
          <div className="lvl"><b>{es ? 'Tratamiento de día' : 'Day treatment'}</b><p>{es ? 'Casi todo el día, casi todos los días, y en la noche a casa.' : 'Most of the day, most days, then home at night. Also called PHP.'}</p></div>
          <div className="lvl"><b>{es ? 'Ambulatorio intensivo' : 'Intensive outpatient'}</b><p>{es ? 'Unas horas, unos días por semana, alrededor del trabajo o la escuela.' : 'A few hours, a few days a week, around work or school. Also called IOP.'}</p></div>
          <div className="lvl"><b>{es ? 'Medicamentos (MAT)' : 'Medication (MAT)'}</b><p>{es ? 'Suboxone, metadona, Vivitrol y otros. Los medicamentos cuentan como recuperación.' : 'Suboxone, methadone, Vivitrol and others. Medication counts as recovery.'}</p></div>
          <div className="lvl"><b>{es ? 'Vivienda de recuperación' : 'Recovery housing'}</b><p>{es ? 'Un lugar sobrio para vivir mientras se reconstruye. No es tratamiento.' : 'A sober place to live while you rebuild. Not treatment itself.'}</p></div>
        </div>
      </section>

      <div className="grid2">
        <div className="card lav"><h3>{es ? '¿Busca ayuda para alguien que ama?' : 'Looking for someone you love?'}</h3><p>{es ? 'Busque de la misma manera y, si pueden, llamen juntos.' : 'Search the same way, then call together if you can. Most programs talk to family members, even if they can’t share details without permission.'}</p><a className="rm-btn sm" href={`${b}/for-you#family`}>{es ? 'Empiece aquí' : 'Start here'}</a></div>
        <div className="card teal"><h3>{es ? '¿Toma medicamentos? Usted es bienvenido.' : 'On medication? You belong here.'}</h3><p>{es ? 'Suboxone, metadona y Vivitrol cuentan como recuperación.' : 'Suboxone, methadone and Vivitrol count as recovery. Filter for programs and houses that welcome it.'}</p><a className="rm-btn teal sm" href={`${b}/search?near=&level=medication_assisted`}>{es ? 'Programas con medicamentos' : 'Programs with medication'}</a></div>
      </div>

      <div className="sbk"><b>{es ? '¿Necesita personas, no solo un programa?' : 'Need people, not just a program?'}</b><p>{es ? 'Sober Book es una red social gratuita para personas en recuperación, de todos los caminos.' : 'Sober Book is a free social network for people in recovery, every path, every day count. Talk to someone who’s been there, any hour.'}</p><a className="rm-btn sm" href="https://soberbook.app">{es ? 'Únase a Sober Book' : 'Join Sober Book'}</a></div>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2>{es ? 'Nuestras promesas' : 'Our promises'}</h2>
        <div className="promise">
          <div>{es ? 'Ningún programa paga por aparecer o por su posición.' : 'No program pays to be listed or ranked.'}</div>
          <div>{es ? 'Sin comisiones por referidos, nunca.' : 'No referral fees, ever, either direction.'}</div>
          <div>{es ? 'Nunca vendemos ni compartimos lo que usted busca.' : 'We never sell or share what you search.'}</div>
          <div>{es ? 'Insignia dorada solo donde la Dra. Labor revisó en persona.' : 'Gold badge only where Dr. Labor checked it herself.'}</div>
        </div>
      </section>
    </div>
  );
}
