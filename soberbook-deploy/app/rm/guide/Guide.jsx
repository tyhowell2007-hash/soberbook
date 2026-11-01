'use client';

import { useState } from 'react';

/* The three-question guide. Asks about danger FIRST: anyone in danger
   is sent to 911 / 988 before a single other question.
   Wording is a draft for Dr. Labor (CONTENT_APPROVED in lib/rm/words). */
const W = {
  en: {
    q1: 'Is anyone in danger right now?', yes: 'Yes', yes_s: 'Overdose, thoughts of suicide, or someone could get hurt', no: 'No', no_s: 'We’re safe, we need a plan',
    danger: 'Call 911 now', danger_b: 'For an overdose, use naloxone (Narcan) if you have it, then call 911. For thoughts of suicide or a mental health crisis, call or text 988, any time.', back: 'Back',
    q2: 'What’s going on?', su: 'Drinking or drugs', mh: 'Mental health', mh_s: 'Depression, anxiety, trauma', both: 'Both',
    q3: 'What do you need first?',
    n: { detox: ['Get through withdrawal safely', 'Shaking, sick, or scared to stop alone'], iop: ['Treatment while living at home', 'Around work, school or kids'],
         residential: ['Get away and focus', 'Live there for a while'], medication_assisted: ['Medication', 'Suboxone, methadone, Vivitrol, naltrexone'],
         sober_living: ['A sober place to live', ''], unsure: ['I honestly don’t know', ''] },
    a: { detox: ['Start with detox', 'Detox gets you through withdrawal with medical help. It’s the first step, not the whole treatment, so ask each place what comes after.'],
         iop: ['Look at intensive outpatient', 'A few hours, a few days a week, and you sleep in your own bed.'],
         residential: ['Look at live-in treatment', 'You stay there, usually a few weeks, with care around the clock.'],
         medication_assisted: ['Look for medication (MAT)', 'Medication counts as recovery. Many outpatient clinics can start it within days.'],
         sober_living: ['Look at recovery housing', 'A sober house gives you a stable place to live. Pair it with treatment or meetings.'],
         unsure: ['Start with an assessment', 'Call a nearby outpatient clinic and ask for an assessment. They’ll tell you what level of care fits. Or call the SAMHSA Helpline: 1-800-662-4357.'] },
    near: 'Town, state or ZIP code', show: 'Show me places', restart: 'Start over',
  },
  es: {
    q1: '¿Alguien está en peligro ahora mismo?', yes: 'Sí', yes_s: 'Sobredosis, pensamientos suicidas, o alguien podría salir herido', no: 'No', no_s: 'Estamos a salvo, necesitamos un plan',
    danger: 'Llame al 911 ahora', danger_b: 'En una sobredosis, use naloxona (Narcan) si la tiene y llame al 911. Si hay pensamientos suicidas o una crisis de salud mental, llame o envíe un texto al 988, a cualquier hora.', back: 'Volver',
    q2: '¿Qué está pasando?', su: 'Alcohol o drogas', mh: 'Salud mental', mh_s: 'Depresión, ansiedad, trauma', both: 'Ambos',
    q3: '¿Qué necesita primero?',
    n: { detox: ['Pasar la abstinencia de forma segura', 'Temblores, malestar, o miedo de dejarlo solo'], iop: ['Tratamiento viviendo en casa', 'Junto al trabajo, la escuela o los hijos'],
         residential: ['Alejarme y enfocarme', 'Vivir allí por un tiempo'], medication_assisted: ['Medicamentos', 'Suboxone, metadona, Vivitrol, naltrexona'],
         sober_living: ['Un lugar sobrio para vivir', ''], unsure: ['De verdad no sé', ''] },
    a: { detox: ['Empiece con desintoxicación', 'La desintoxicación le ayuda a pasar la abstinencia con apoyo médico. Es el primer paso, no todo el tratamiento.'],
         iop: ['Busque ambulatorio intensivo', 'Unas horas, unos días por semana, y duerme en su casa.'],
         residential: ['Busque tratamiento residencial', 'Se queda allí, normalmente unas semanas, con atención todo el día.'],
         medication_assisted: ['Busque medicamentos (MAT)', 'Los medicamentos cuentan como recuperación. Muchas clínicas pueden empezar en días.'],
         sober_living: ['Busque vivienda de recuperación', 'Una casa sobria le da un lugar estable para vivir. Combínela con tratamiento o reuniones.'],
         unsure: ['Empiece con una evaluación', 'Llame a una clínica ambulatoria cercana y pida una evaluación. O llame a la Línea de ayuda de SAMHSA: 1-800-662-4357.'] },
    near: 'Ciudad, estado o código postal', show: 'Mostrar lugares', restart: 'Empezar de nuevo',
  },
};

export default function Guide({ base, lang }) {
  const w = W[lang] || W.en;
  const [step, setStep] = useState(1);
  const [what, setWhat] = useState(null);
  const [need, setNeed] = useState(null);
  const restart = () => { setStep(1); setWhat(null); setNeed(null); };
  const on = (i) => (typeof step === 'number' && i <= step ? 'on' : '');
  const opt = (label, sub, fn, key) => (
    <button key={key || label} type="button" className="opt" onClick={fn}><b>{label}</b>{sub ? <span>{sub}</span> : null}</button>
  );
  return (
    <>
      <div className="progress" aria-hidden="true"><i className={on(1)} /><i className={on(2)} /><i className={on(3)} /></div>
      {step === 1 && <div className="step"><h2>{w.q1}</h2><div className="opts">
        {opt(w.yes, w.yes_s, () => setStep('danger'))}{opt(w.no, w.no_s, () => setStep(2))}
      </div></div>}
      {step === 'danger' && <div className="danger" role="alert"><span className="big">{w.danger}</span><p>{w.danger_b}</p>
        <div className="actions"><a className="btn" style={{ background: '#fff', color: 'var(--crisis)' }} href="tel:911">911</a><a className="btn" style={{ background: '#fff', color: 'var(--crisis)' }} href="tel:988">988</a><button type="button" className="btn ghost sm" style={{ background: '#fff' }} onClick={restart}>{w.back}</button></div></div>}
      {step === 2 && <div className="step"><h2>{w.q2}</h2><div className="opts">
        {opt(w.su, '', () => { setWhat('su'); setStep(3); })}{opt(w.mh, w.mh_s, () => { setWhat('mh'); setStep(3); })}{opt(w.both, '', () => { setWhat('any'); setStep(3); })}
      </div></div>}
      {step === 3 && <div className="step"><h2>{w.q3}</h2><div className="opts">
        {Object.entries(w.n).map(([k, [a, s]]) => opt(a, s, () => { setNeed(k); setStep(4); }, k))}
      </div></div>}
      {step === 4 && need && (
        <div className="answer">
          <h2>{w.a[need][0]}</h2><p>{w.a[need][1]}</p>
          <form className="search" action={`${base}/search`} method="get">
            <input name="near" placeholder={w.near} aria-label={w.near} required />
            {what && what !== 'any' && <input type="hidden" name="help" value={what} />}
            {need !== 'unsure' && <input type="hidden" name="level" value={need} />}
            <button className="btn" type="submit">{w.show}</button>
          </form>
          <button type="button" className="btn ghost sm" onClick={restart}>{w.restart}</button>
        </div>
      )}
    </>
  );
}
