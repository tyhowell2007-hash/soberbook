import { lang } from '../../../lib/rm/server';

export const metadata = { title: 'Meet Dr. Nicole Labor', description: 'Dr. Nicole Labor, DO, FASAM: addiction medicine physician, author, and the doctor behind RecoveryMap.' };

/* Every line comes from ASAM's published biography and theaddictsdoc.com.
   🔴 She is a DO, not an MD. Don't write "MD" anywhere. No "bestselling",
   no follower counts, no awards: none could be confirmed. */
export default function About() {
  const es = lang() === 'es';
  return (
    <div className="page">
      <div className="about">
        <img className="big" src="/rm/drlabor.jpg" alt="Dr. Nicole Labor" width="560" height="560" />
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="eyebrow">{es ? 'La doctora detrás de RecoveryMap' : 'Meet the doctor behind RecoveryMap'}</div>
          <h1>Dr. Nicole Labor, DO, FASAM</h1>
          <p className="lede">{es ? 'Médica de medicina de adicciones, autora y, como ella misma dice, “asesina del estigma.” Está en recuperación desde 2005 y ha dedicado su carrera a enseñar que la adicción es química cerebral, no un defecto de carácter.' : 'Addiction medicine physician, author and self-described stigma slayer. She has been in recovery since 2005 and has spent her career teaching that addiction is brain chemistry, not a character flaw. She built RecoveryMap so families could find real help without wading through ads.'}</p>
          <div className="timeline">
            <div><b>2005</b><span>{es ? 'Comienza su propia recuperación' : 'Begins her own recovery'}</span></div>
            <div><b>2007</b><span>Doctor of Osteopathic Medicine, Lake Erie College of Osteopathic Medicine</span></div>
            <div><b>2010</b><span>{es ? 'Certificada en Medicina Familiar (residencia en SUNY Buffalo)' : 'Board-certified in Family Medicine (residency at SUNY Buffalo)'}</span></div>
            <div><b>2013</b><span>{es ? 'Certificada en Medicina de Adicciones' : 'Board-certified in Addiction Medicine (fellowship through Geisinger Marworth)'}</span></div>
            <div><b>{es ? 'Hoy' : 'Since'}</b><span>{es ? 'Creó la beca de medicina de adicciones de Summa Health; directora médica de programas en Ohio y Pensilvania; Fellow de ASAM' : 'Built Summa Health’s addiction medicine fellowship in Akron; medical director for treatment programs in Ohio and Pennsylvania; Fellow of the American Society of Addiction Medicine'}</span></div>
          </div>
        </div>
      </div>
      <section style={{ display: 'grid', gap: 12 }}>
        <h2>{es ? 'Léala, escúchela' : 'Read her, hear her'}</h2>
        <div className="books">
          <a className="book" href="https://www.theaddictsdoc.com/books" target="_blank" rel="noopener noreferrer"><b>The Addictoholic Deconstructed</b><span>Book · 2019</span></a>
          <a className="book" href="https://www.theaddictsdoc.com/books" target="_blank" rel="noopener noreferrer"><b>Reconstructing</b><span>{es ? 'Libro' : 'Book · reflections for people in recovery'}</span></a>
          <a className="book" href="https://www.theaddictsdoc.com/books" target="_blank" rel="noopener noreferrer"><b>Addictoholic Workbook: Reconstructed</b><span>Workbook</span></a>
          <a className="book" href="https://theaddictsdoc.substack.com" target="_blank" rel="noopener noreferrer"><b>The Addicts Doc</b><span>{es ? 'Boletín en Substack' : 'Newsletter on Substack'}</span></a>
        </div>
      </section>
    </div>
  );
}
