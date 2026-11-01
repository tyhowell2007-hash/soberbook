import { base, lang } from '../../../lib/rm/server';
import { CONTENT_APPROVED } from '../../../lib/rm/words';
import { t } from '../../../lib/rm/t';
import Guide from './Guide';

export const metadata = { title: 'Not sure what you need?' };

export default function GuidePage() {
  const L = lang();
  return (
    <div className="page">
      <div className="guide">
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="eyebrow">{L === 'es' ? '¿No sabe qué necesita?' : 'Not sure what you need?'}</div>
          <h1>{L === 'es' ? 'Tres preguntas. Sin registrarse.' : 'Three questions. No sign-up.'}</h1>
          <p className="lede">{L === 'es' ? 'Nada de lo que elija aquí se guarda ni se envía.' : 'Nothing you choose here is saved or sent anywhere.'}</p>
          {!CONTENT_APPROVED && <span className="draft">{t('draft', L)}</span>}
        </div>
        <Guide base={base()} lang={L} />
      </div>
    </div>
  );
}
