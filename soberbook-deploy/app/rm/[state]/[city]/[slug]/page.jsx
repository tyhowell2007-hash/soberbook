import { notFound, permanentRedirect } from 'next/navigation';
import { base, lang, db } from '../../../../../lib/rm/server';
import { t } from '../../../../../lib/rm/t';
import { HELP, HELP_LONG, helpKind, levels, programs, certs, pays, langs, cleanName, splitPhone, placePath, STATE_NAME } from '../../../../../lib/rm/words';
import { TapLink, SendList } from '../../../search/SearchBits';
import { NumberWorked, UpdateForm } from './PlaceBits';

export const dynamic = 'force-dynamic';

/* =====================================================================
   ONE PLACE. A permanent address: /oh/cadiz/southeast-healthcare-cadiz-oh
   (the old site used a serial number that changed on every data refresh,
   breaking every saved and shared link).

   ⭐ Drawn on the server with its own title, description and share card,
   so a texted link shows the place, the town and the phone number, and
   Google sees a real page instead of an empty shell.
   ===================================================================== */
async function load(slug) {
  const { data } = await db().rpc('rm_center', { p_slug: slug });
  return data || null;
}

export async function generateMetadata({ params }) {
  const c = await load(params.slug);
  if (!c) return { title: 'Not found' };
  const n = cleanName(c.name), ph = splitPhone(c.admissions_phone || c.phone);
  const what = levels(c.levels_of_care).slice(0, 3).join(', ').toLowerCase();
  const desc = `${n.name}${n.site ? ` (${n.site})` : ''} in ${c.city}, ${STATE_NAME[c.state] || c.state}. ${what ? what[0].toUpperCase() + what.slice(1) + '. ' : ''}${ph.dial ? 'Call ' + ph.dial + '. ' : ''}${c.badge ? 'Checked by Dr. Nicole Labor, DO.' : 'Free directory, no paid listings.'}`;
  return {
    title: `${n.name}, ${c.city}, ${c.state}`,
    description: desc,
    alternates: { canonical: placePath(c) },
    openGraph: { title: `${n.name} · ${c.city}, ${c.state}`, description: desc },
  };
}

export default async function Place({ params }) {
  const b = base(), L = lang(), es = L === 'es';
  const c = await load(params.slug);
  if (!c) notFound();
  /* A link with the wrong state or town still lands on the right page. */
  const want = placePath(c);
  if (`/${params.state}/${params.city}/${params.slug}` !== want) permanentRedirect(b + want);

  const n = cleanName(c.name), k = helpKind(c.services);
  const main = splitPhone(c.admissions_phone || c.phone), other = c.admissions_phone ? splitPhone(c.phone) : null;
  const payList = pays(c.insurance_accepted, L).concat(c.sliding_scale ? [es ? 'Escala móvil' : 'Sliding scale'] : []);
  const progs = programs(c.specialties, L);
  const facts = c.provider?.facts || {};
  const addr = [c.address_line1, `${c.city}, ${c.state} ${c.zip || ''}`.trim()].filter(Boolean).join(', ');
  const dirs = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
  const near = (c.near || []).map((o) => ({ ...o, mi: parseFloat(o.mi) }));

  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="small"><a href={`${b}/search?near=${encodeURIComponent(c.zip || `${c.city}, ${c.state}`)}`}>{t('back_results', L)}</a></p>
        <span className={`pill p-${k}`}>{HELP[L][k]}</span>
        <h1>{n.name}</h1>
        <p className="lede" style={{ marginTop: -6 }}>{n.site ? `${n.site} · ` : ''}{c.city}, {STATE_NAME[c.state] || c.state}</p>
        {c.badge
          ? <span className="vb"><i>✓</i>{es ? 'Revisado por la Dra. Nicole Labor, DO' : 'Checked by Dr. Nicole Labor, DO'} · {new Date(c.badge.checked_on).toLocaleDateString(es ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
          : <span className="src">{t('from_samhsa', L)} · {t('not_checked', L)}</span>}
      </div>

      <div className="detail">
        <div>
          {c.badge?.note && (
            <div className="drnote"><img src="/rm/drlabor.jpg" alt="" width="52" height="52" /><div><b>{t('dr_note', L)}</b><p>{c.badge.note}</p></div></div>
          )}
          <dl>
            <div className="row"><dt>{t('kinds', L)}</dt><dd>{levels(c.levels_of_care, L).join(' · ') || (es ? 'Llame para preguntar' : 'Call to ask')}</dd></div>
            <div className="row"><dt>{t('helps', L)}</dt><dd>{HELP_LONG[L][k]}</dd></div>
            {progs.length > 0 && <div className="row"><dt>{t('special', L)}</dt><dd>{progs.join(' · ')}{(c.specialties || []).some((s) => s === 'women_only' || s === 'men_only') && <span className="small">{t('prog_note', L)}</span>}</dd></div>}
            {certs(c.certifications, L).length > 0 && <div className="row"><dt>{t('licensed', L)}</dt><dd>{certs(c.certifications, L).join(' · ')}</dd></div>}
            <div className="row"><dt>{t('pay', L)}</dt><dd>{payList.length ? payList.join(' · ') : t('call_to_ask', L)}</dd></div>
            {langs(c.languages, L).length > 0 && <div className="row"><dt>{t('languages', L)}</dt><dd>{langs(c.languages, L).join(' · ')}</dd></div>}
            {Object.keys(facts).length > 0 && (
              <div className="row"><dt>{t('provider_rep', L)}</dt><dd style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 10 }}>
                {facts.hours && <span>{es ? 'Horario' : 'Hours'}: {facts.hours}</span>}
                {facts.website && <span>{es ? 'Sitio web' : 'Website'}: {facts.website}</span>}
                {facts.mat_friendly && <span>{es ? 'Acepta personas con medicamentos (MAT)' : 'Welcomes people on medication (MAT)'}: {facts.mat_friendly}</span>}
                {facts.takes_children && <span>{es ? 'Acepta niños' : 'Takes parents with children'}: {facts.takes_children}</span>}
                {facts.lgbtq_affirming && <span>LGBTQ+ {es ? 'afirmativo' : 'affirming'}: {facts.lgbtq_affirming}</span>}
                {facts.court_involved && <span>{es ? 'Personas de la corte o cárcel' : 'Serves people coming from court or jail'}: {facts.court_involved}</span>}
                {facts.walk_ins && <span>{es ? 'Sin cita' : 'Walk-ins'}: {facts.walk_ins}</span>}
                {facts.languages && <span>{t('languages', L)}: {facts.languages}</span>}
                <span className="small">{es ? 'Enviado por el programa y revisado por nuestro equipo. No confirmado de forma independiente.' : 'Sent in by the program and reviewed by our team. Not independently confirmed.'}</span>
              </dd></div>
            )}
            <div className="row"><dt>{t('address', L)}</dt><dd>{c.address_line1 ? addr : (es ? `Llame para la dirección · ${c.city}, ${c.state}` : `Call for the address · ${c.city}, ${c.state}`)}{c.address_line1 && <a href={dirs} target="_blank" rel="noopener noreferrer">{t('directions', L)}</a>}</dd></div>
            <div className="row"><dt>{t('source', L)}</dt><dd><span>{es ? 'Directorio nacional 2025 de SAMHSA' : 'SAMHSA’s 2025 national directory'}{c.badge ? (es ? ', revisado por la Dra. Labor' : ', checked by Dr. Labor') : ''}.</span>{n.changed && <span className="small">{es ? 'Nombre en SAMHSA' : 'Listed by SAMHSA as'} “{n.original}”</span>}</dd></div>
          </dl>
          <details className="card">
            <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{t('work_here', L)}</summary>
            <UpdateForm center={c.id} lang={L} />
          </details>
        </div>

        <aside>
          {main.dial ? (
            <div className="callbox">
              <span className="small">{c.admissions_phone ? t('admissions', L) : t('call', L)}</span>
              <TapLink id={c.id} className="num" dial={main.dial} />
              {main.ext && <span>{t('ask_for_ext', L)} <b>{main.ext}</b></span>}
              {other?.dial && other.dial !== main.dial && <span className="small">{es ? 'Línea principal' : 'Main line'} {other.dial}{other.ext ? ` ext. ${other.ext}` : ''}</span>}
              <span className="small">{t('call_tip', L)}</span>
            </div>
          ) : null}
          <NumberWorked center={c.id} lang={L} />
          <SendList label={t('send_phone', L)} lang={L} rows={[{ n: n.name, c: `${c.city}, ${c.state}`, ...main }]} />
          <div className="card"><h3>{t('before_call', L)}</h3><ul className="ask"><li>{t('q1', L)}</li><li>{t('q2', L)}</li><li>{t('q3', L)}</li><li>{t('q4', L)}</li></ul></div>
          {near.length > 0 && (
            <div className="card near"><h3>{t('closest_other', L)}</h3>
              {near.map((o) => <div key={o.slug}><a href={b + placePath(o)}>{cleanName(o.name).name}</a><b>{o.mi < 1 ? o.city : `${Math.round(o.mi)} mi`}</b></div>)}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
