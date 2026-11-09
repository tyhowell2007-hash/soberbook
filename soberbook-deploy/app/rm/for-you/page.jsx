import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';
import Guide from '../guide/Guide';

export const metadata = { title: 'Start here', description: 'Three questions to find the right kind of care, plus starting points for families, teens, pregnant and new moms, veterans, people leaving jail, and people without insurance.' };

/* =====================================================================
   START HERE. One page for "help me decide" (9 Nov 2026, Kenny).
   Used to be three pages that overlapped: /guide (3 questions),
   /for-you (situations) and /no-insurance. They now live here, in that
   order. /guide and /no-insurance redirect to #guide and #money, so old
   links and bookmarks still land in the right spot.
   ===================================================================== */
export default function StartHere() {
  const b = base(), L = lang(), es = L === 'es';
  const C = [
    ['family', 'Worried about someone you love', ['You can’t force an adult into treatment, but you can have a list ready for the moment they say yes.', 'Search the same way you would for yourself, then call together if you can.', 'Keep Narcan in the house if opioids are involved.', 'Al-Anon and Nar-Anon are free meetings for family.'], `${b}/meetings`, 'Family meetings'],
    ['teens', 'Teens and young adults', ['Look for “Program for teens” or “Program for young adults” on a listing.', 'In Ohio, teens can agree to some addiction treatment on their own. Rules differ by state, so ask the program.', '988 takes calls and texts from teens too.'], `${b}/search?prog=adolescent`, 'Programs for teens'],
    ['moms', 'Pregnant or a new mom', ['Programs that take federal treatment money must give pregnant women priority for admission.', 'Medication like buprenorphine or methadone is recommended in pregnancy for opioid use. Ask your doctor.', 'Look for “Program for pregnant & new moms.”'], `${b}/search?prog=pregnant_postpartum`, 'Programs for moms'],
    ['veterans', 'Veterans', ['Veterans Crisis Line: dial 988, then press 1.', 'VA clinics offer outpatient treatment and medication. Search near you.', 'Look for “Program for veterans.”'], `${b}/search?prog=veterans`, 'Programs for veterans'],
    ['reentry', 'Leaving jail or prison', ['Tolerance drops fast inside. The first weeks out carry the highest overdose risk. Carry Narcan.', 'Ask before release about restarting Medicaid and medication.', 'Some programs serve people coming from court or jail. Call and ask.'], `${b}/narcan`, 'Get Narcan'],
    ['medication', 'On medication', ['Suboxone, methadone and Vivitrol count as recovery.', 'Filter for programs that offer medication (MAT).', 'Some sober houses still turn people away for it. Every Oxford House welcomes it.'], `${b}/search?level=medication_assisted`, 'Programs with medication (MAT)'],
  ];
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="eyebrow">{es ? 'Empiece aquí' : 'Start here'}</div>
        <h1>{es ? 'Ayuda que empieza donde usted está' : 'Help that starts where you are'}</h1>
        {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}
      </div>

      <section id="guide" className="guide" style={{ scrollMarginTop: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <h2>{es ? '¿No sabe qué necesita? Tres preguntas.' : 'Not sure what you need? Three questions.'}</h2>
          <p className="lede">{es ? 'Sin registrarse. Nada de lo que elija aquí se guarda ni se envía.' : 'No sign-up. Nothing you choose here is saved or sent anywhere.'}</p>
        </div>
        <Guide base={b} lang={L} />
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <h2>{es ? 'Empiece aquí si usted es…' : 'Start here if you’re…'}</h2>
        <div className="grid2">{C.map(([id, h, tips, href, cta]) => (
          <div className="card" id={id} key={id} style={{ scrollMarginTop: 16 }}><h3>{h}</h3><ul className="rm-ask">{tips.map((x) => <li key={x}>{x}</li>)}</ul><a className="rm-btn sm" href={href}>{cta}</a></div>
        ))}</div>
      </section>

      {/* Was /no-insurance. Same words, same Spanish. */}
      <section id="money" style={{ display: 'grid', gap: 14, scrollMarginTop: 16 }}>
        <h2>{es ? '¿Sin seguro? El dinero no debería decidir si recibe ayuda' : 'Without insurance? Money shouldn’t decide whether you get help'}</h2>
        <div className="grid3">
          <div className="card"><h3>{es ? 'Pague lo que pueda' : 'Pay what you can'}</h3><p>{es ? 'Muchos lugares cobran según sus ingresos (escala móvil).' : 'Many places charge by what you earn. That’s called a sliding scale.'}</p><a className="rm-btn sm" href={`${b}/search?pay=sliding`}>{es ? 'Buscar escala móvil' : 'Find sliding scale near you'}</a></div>
          <div className="card"><h3>{es ? 'Solicite Medicaid' : 'Apply for Medicaid'}</h3><p>{es ? 'Si vive en Ohio y el dinero es poco, puede calificar. Solicite en benefits.ohio.gov, en la oficina de Job and Family Services de su condado, o llame a la línea de Ohio Medicaid: 1-800-324-8680.' : 'If you live in Ohio and money is tight, you may qualify. Apply at benefits.ohio.gov, at your county Job and Family Services office, or call the Ohio Medicaid Consumer Hotline at 1-800-324-8680. Many treatment programs will help you apply.'}</p></div>
          <div className="card"><h3>{es ? 'Fondos estatales y federales' : 'State and federal money'}</h3><p>{es ? 'Muchos programas tienen fondos para personas sin seguro. Pregunte: “¿Tienen fondos para personas sin seguro?”' : 'Many programs take state funding or federal grants to cover people without insurance. Ask: “Do you have funding for people without insurance?”'}</p></div>
        </div>
        <div className="card teal"><h3>{es ? 'Transporte gratis al tratamiento' : 'Free rides to treatment'}</h3><p style={{ fontSize: 16 }}>{es ? 'Ohio Medicaid cubre el transporte a citas médicas, y el tratamiento cuenta. Llame al número de servicios para miembros en su tarjeta de Medicaid o a Job and Family Services de su condado unos días antes. Los planes varían.' : 'Ohio Medicaid covers rides to medical appointments, and treatment counts. Call the member services number on your Medicaid card, or your county Job and Family Services office, a few days ahead. Plans differ, so ask what yours covers.'}</p></div>
      </section>
    </div>
  );
}
