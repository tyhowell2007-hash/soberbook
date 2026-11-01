'use client';

import { useState } from 'react';
import { browserClient } from '../../../../../lib/supabase-browser';

/* "Did this number work?"  No → a 'phone' report in listing_reports,
   which shows up in /admin/listings for Ty and Kenny (0198 + 0193). */
export function NumberWorked({ center, lang }) {
  const es = lang === 'es';
  const [done, setDone] = useState('');
  const say = async (ok) => {
    setDone(ok ? 'yes' : 'no');
    if (!ok) { try { await browserClient().rpc('rm_report_number', { p_center: center }); } catch {} }
  };
  if (done) return <div className="worked" role="status"><b>{done === 'yes'
    ? (es ? 'Gracias. Eso ayuda a la próxima persona.' : 'Thanks. That helps the next person.')
    : (es ? 'Gracias. Nuestro equipo revisará este número en una semana.' : 'Thanks. Our team will check this number within a week.')}</b></div>;
  return (
    <div className="worked">
      <b>{es ? '¿Funcionó este número?' : 'Did this number work?'}</b>
      <button type="button" className="btn ok sm" onClick={() => say(true)}>{es ? 'Sí' : 'Yes'}</button>
      <button type="button" className="btn no sm" onClick={() => say(false)}>No</button>
    </div>
  );
}

/* "Work here? Send an update."  Goes to the private review queue; nothing
   is public until Kenny, Ty or Dr. Labor approves it.
   🔴 There is deliberately NO box for success rates or outcomes.
   ⚠️ The hidden "website2" field is a spam trap: a person never sees it,
   a robot fills it, and then nothing is sent. */
export function UpdateForm({ center, lang }) {
  const es = lang === 'es';
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('website2')) { setState({ busy: false, ok: true, msg: es ? 'Gracias.' : 'Thank you.' }); return; }
    const facts = {};
    for (const k of ['phone', 'website', 'hours', 'mat_friendly', 'takes_children', 'lgbtq_affirming', 'court_involved', 'walk_ins', 'languages', 'note']) {
      const v = String(f.get(k) || '').trim();
      if (v) facts[k] = v;
    }
    if (!Object.keys(facts).length) { setState({ busy: false, ok: false, msg: es ? 'Agregue al menos un dato.' : 'Add at least one detail to update.' }); return; }
    setState({ busy: true, ok: false, msg: '' });
    const { error } = await browserClient().rpc('rm_submit_update', {
      p_center: center, p_facts: facts, p_name: f.get('name'), p_email: f.get('email'), p_role: f.get('role') || null,
    });
    setState(error
      ? { busy: false, ok: false, msg: error.message }
      : { busy: false, ok: true, msg: es ? 'Gracias. Nuestro equipo lo revisará antes de publicarlo.' : 'Thank you. Our team reviews every update before it goes live.' });
  };
  if (state.ok) return <p role="status" style={{ marginTop: 10 }}><b>{state.msg}</b></p>;
  const yn = (name, label) => (
    <label>{label}<select name={name} defaultValue=""><option value="">{es ? '—' : '—'}</option><option value="Yes">{es ? 'Sí' : 'Yes'}</option><option value="No">No</option></select></label>
  );
  return (
    <form className="form" onSubmit={submit} style={{ marginTop: 12 }}>
      <p className="small">{es ? 'Solo lo que su programa ofrece. No publicamos tasas de éxito ni resultados.' : 'Only what your program offers. We don’t publish success rates, outcomes or guarantees.'}</p>
      <div className="two">
        <label>{es ? 'Teléfono correcto' : 'Correct phone'}<input name="phone" maxLength={40} /></label>
        <label>{es ? 'Sitio web' : 'Website'}<input name="website" maxLength={120} /></label>
        <label>{es ? 'Horario' : 'Hours'}<input name="hours" maxLength={120} placeholder="Mon–Fri 8–5" /></label>
        <label>{es ? 'Idiomas' : 'Languages'}<input name="languages" maxLength={120} /></label>
        {yn('mat_friendly', es ? 'Acepta personas con medicamentos (MAT)' : 'Welcomes people on medication (MAT)')}
        {yn('takes_children', es ? 'Acepta padres con hijos' : 'Takes parents with children')}
        {yn('lgbtq_affirming', 'LGBTQ+ affirming')}
        {yn('court_involved', es ? 'Personas de la corte o cárcel' : 'Serves people from court or jail')}
        {yn('walk_ins', es ? 'Acepta sin cita' : 'Walk-ins welcome')}
      </div>
      <label>{es ? 'Algo más' : 'Anything else'}<textarea name="note" rows={3} maxLength={600} /></label>
      <div className="two">
        <label>{es ? 'Su nombre' : 'Your name'}<input name="name" required maxLength={120} autoComplete="name" /></label>
        <label>{es ? 'Correo del trabajo' : 'Work email'}<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
        <label>{es ? 'Su puesto' : 'Your role'}<input name="role" maxLength={80} placeholder={es ? 'Admisiones' : 'Intake coordinator'} /></label>
      </div>
      <div className="hp" aria-hidden="true"><label>Website<input name="website2" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="small">{es ? 'Su nombre y correo se mantienen privados. Solo los usamos si necesitamos preguntarle sobre su actualización.' : 'Your name and email stay private. We only use them if we need to ask about your update.'}</p>
      <button className="btn sm" type="submit" disabled={state.busy}>{state.busy ? '…' : (es ? 'Enviar' : 'Send update')}</button>
      {state.msg && <p role="alert" className="small" style={{ color: 'var(--no)' }}>{state.msg}</p>}
    </form>
  );
}
