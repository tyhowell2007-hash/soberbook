import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';

export const metadata = { title: 'No insurance? Start here', description: 'Pay-what-you-can treatment, state-funded programs, how to apply for Ohio Medicaid, and free Medicaid rides to treatment.' };

export default function NoInsurance() {
  const b = base(), L = lang(), es = L === 'es';
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}><div className="eyebrow">{es ? '¿Sin seguro? Empiece aquí' : 'No insurance? Start here'}</div><h1>{es ? 'El dinero no debería decidir si recibe ayuda' : 'Money shouldn’t decide whether you get help'}</h1>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}</div>
      <div className="grid3">
        <div className="card"><h3>{es ? 'Pague lo que pueda' : 'Pay what you can'}</h3><p>{es ? 'Muchos lugares cobran según sus ingresos (escala móvil).' : 'Many places charge by what you earn. That’s called a sliding scale.'}</p><a className="btn sm" href={`${b}/search?pay=sliding`}>{es ? 'Buscar escala móvil' : 'Find sliding scale near you'}</a></div>
        <div className="card"><h3>{es ? 'Solicite Medicaid' : 'Apply for Medicaid'}</h3><p>{es ? 'Si vive en Ohio y el dinero es poco, puede calificar. Solicite en benefits.ohio.gov, en la oficina de Job and Family Services de su condado, o llame a la línea de Ohio Medicaid: 1-800-324-8680.' : 'If you live in Ohio and money is tight, you may qualify. Apply at benefits.ohio.gov, at your county Job and Family Services office, or call the Ohio Medicaid Consumer Hotline at 1-800-324-8680. Many treatment programs will help you apply.'}</p></div>
        <div className="card"><h3>{es ? 'Fondos estatales y federales' : 'State and federal money'}</h3><p>{es ? 'Muchos programas tienen fondos para personas sin seguro. Pregunte: “¿Tienen fondos para personas sin seguro?”' : 'Many programs take state funding or federal grants to cover people without insurance. Ask: “Do you have funding for people without insurance?”'}</p></div>
      </div>
      <div className="card teal"><h2>{es ? 'Transporte gratis al tratamiento' : 'Free rides to treatment'}</h2><p style={{ fontSize: 16 }}>{es ? 'Ohio Medicaid cubre el transporte a citas médicas, y el tratamiento cuenta. Llame al número de servicios para miembros en su tarjeta de Medicaid o a Job and Family Services de su condado unos días antes. Los planes varían.' : 'Ohio Medicaid covers rides to medical appointments, and treatment counts. Call the member services number on your Medicaid card, or your county Job and Family Services office, a few days ahead. Plans differ, so ask what yours covers.'}</p></div>
    </div>
  );
}
