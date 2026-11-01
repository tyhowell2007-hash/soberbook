import { base, lang, db, geocode } from '../../../lib/rm/server';
import { t } from '../../../lib/rm/t';
import { LEVEL, HELP, helpKind, levels, programs, cleanName, splitPhone, placePath, miles } from '../../../lib/rm/words';
import NearMe from '../NearMe';
import { AutoSubmit, SendList, TapLink } from './SearchBits';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find care near you' };

/* =====================================================================
   SEARCH. A plain GET form drawn on the server, so it works with no
   JavaScript, on any phone, and every search is a link you can send.

   🔴 Never searches "the whole country" by accident. The old site, given
   a ZIP it didn't know, silently dropped the distance and listed 19,490
   places starting in Alabama. Here, an unknown place says so.
   ===================================================================== */
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const LEVEL_KEYS = ['detox', 'residential', 'php', 'iop', 'medication_assisted', 'sober_living'];
const PROG_KEYS = [['women_only', 'women'], ['pregnant_postpartum', 'moms'], ['veterans', 'vets'], ['adolescent', 'teens']];
const PAY_KEYS = [['medicaid', 'Medicaid'], ['medicare', 'Medicare'], ['private', 'private_ins'], ['sliding', 'sliding']];
const PER = 20;

export default async function Search({ searchParams }) {
  const b = base(), L = lang(), es = L === 'es';
  const sp = searchParams || {};
  const near = String(sp.near || '').slice(0, 80);
  const where = geocode(near);
  const r = [10, 20, 30, 50].includes(+sp.r) ? +sp.r : 30;
  const help = ['su', 'mh'].includes(sp.help) ? sp.help : 'any';
  const lv = arr(sp.level).filter((x) => LEVEL_KEYS.includes(x) || x === 'outpatient');
  const pg = arr(sp.prog).filter((x) => PROG_KEYS.some((p) => p[0] === x));
  const pay = arr(sp.pay).filter((x) => PAY_KEYS.some((p) => p[0] === x));
  const sort = sp.sort === 'name' ? 'name' : 'mi';
  const view = sp.view === 'map' ? 'map' : 'list';
  const page = Math.max(1, Math.min(50, parseInt(sp.page || '1', 10) || 1));

  let rows = [], total = 0, facets = null, err = null;
  if (where) {
    const [res, fac] = await Promise.all([
      db().rpc('rm_search', { p_lat: where.lat, p_lon: where.lon, p_radius: r, p_help: help,
        p_levels: lv, p_programs: pg, p_pay: pay, p_sort: sort, p_limit: PER, p_offset: (page - 1) * PER }),
      db().rpc('rm_facets', { p_lat: where.lat, p_lon: where.lon, p_radius: r, p_help: help }),
    ]);
    if (res.error) err = res.error.message;
    rows = res.data || [];
    total = rows[0]?.total || 0;
    facets = fac.data || null;
  }
  const ct = (k) => (facets && facets[k] != null ? facets[k] : '');
  const qs = (over) => {
    const p = new URLSearchParams();
    const all = { near, r, help, sort, view, ...over };
    for (const [k, v] of Object.entries(all)) if (v != null && v !== '' && !(k === 'help' && v === 'any') && !(k === 'sort' && v === 'mi') && !(k === 'view' && v === 'list')) p.set(k, v);
    for (const v of (over.level ?? lv)) p.append('level', v);
    for (const v of (over.prog ?? pg)) p.append('prog', v);
    for (const v of (over.pay ?? pay)) p.append('pay', v);
    return `${b}/search?${p.toString()}`;
  };

  /* SVG map: plot results by lat/lon inside a box around the origin. */
  const mapPins = where && rows.length ? (() => {
    const lats = [where.lat, ...rows.map((x) => x.latitude)], lons = [where.lon, ...rows.map((x) => x.longitude)];
    const mnA = Math.min(...lats), mxA = Math.max(...lats), mnO = Math.min(...lons), mxO = Math.max(...lons);
    const sx = (o) => 6 + ((o - mnO) / Math.max(mxO - mnO, 0.01)) * 88, sy = (a) => 6 + ((mxA - a) / Math.max(mxA - mnA, 0.01)) * 88;
    return { me: [sx(where.lon), sy(where.lat)], pins: rows.map((x) => ({ x: sx(x.longitude), y: sy(x.latitude), r: x })) };
  })() : null;

  return (
    <div className="page">
      <div className="bar">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>{where ? `${t('help_near', L)} ${where.label}` : t('where_q', L)}</h1>
          {where && <p className="small" aria-live="polite">{total} {t('places_within', L)} {r} {t('miles_word', L)}, {sort === 'name' ? t('az', L) : t('closest_first', L)}</p>}
        </div>
        {where && rows.length > 0 && (
          <div className="actions">
            <SendList label={t('send_list', L)} rows={rows.slice(0, 5).map((x) => ({ n: cleanName(x.name).name, c: `${x.city}, ${x.state}`, ...splitPhone(x.admissions_phone || x.phone) }))} lang={L} />
            <div className="seg" role="group" aria-label="View">
              <a href={qs({ view: 'list' })} aria-current={view === 'list' ? 'true' : undefined}>{t('list', L)}</a>
              <a href={qs({ view: 'map' })} aria-current={view === 'map' ? 'true' : undefined}>{t('map', L)}</a>
            </div>
          </div>
        )}
      </div>

      <form className="search" action={`${b}/search`} method="get" role="search">
        <input name="near" defaultValue={near} placeholder={t('near_ph', L)} aria-label={t('near_ph', L)} />
        {lv.map((v) => <input key={v} type="hidden" name="level" value={v} />)}
        <NearMe action={`${b}/search`} label={t('near_me', L)} extra={lv.map((v) => `&level=${v}`).join('')} />
        <button className="btn" type="submit">{t('find', L)}</button>
      </form>
      {near && !where && <p className="empty" role="alert">{t('where_bad', L)}</p>}

      {where && (
        <div className="sgrid">
          <form className="filters" action={`${b}/search`} method="get" id="rm-filters" aria-label="Filters">
            <AutoSubmit form="rm-filters" />
            <input type="hidden" name="near" value={near} />
            {sort !== 'mi' && <input type="hidden" name="sort" value={sort} />}
            {view !== 'list' && <input type="hidden" name="view" value={view} />}
            <fieldset className="fg"><legend>{t('how_far', L)}</legend>
              {[10, 20, 30, 50].map((m) => <label key={m}><input type="radio" name="r" value={m} defaultChecked={r === m} /> {m} {t('miles_word', L)}</label>)}
            </fieldset>
            <fieldset className="fg"><legend>{t('help_with', L)}</legend>
              <label><input type="radio" name="help" value="any" defaultChecked={help === 'any'} /> {t('anything', L)}</label>
              <label><input type="radio" name="help" value="su" defaultChecked={help === 'su'} /> {t('drugs_alcohol', L)}</label>
              <label><input type="radio" name="help" value="mh" defaultChecked={help === 'mh'} /> {t('mental_health', L)}</label>
            </fieldset>
            <fieldset className="fg"><legend>{t('kind_of_care', L)}</legend>
              {LEVEL_KEYS.map((k) => <label key={k}><input type="checkbox" name="level" value={k} defaultChecked={lv.includes(k)} /> {LEVEL[L][k]} <span className="ct">{ct(k)}</span></label>)}
            </fieldset>
            <fieldset className="fg"><legend>{t('program_for', L)}</legend>
              {PROG_KEYS.map(([k, w]) => <label key={k}><input type="checkbox" name="prog" value={k} defaultChecked={pg.includes(k)} /> {t(w, L)} <span className="ct">{ct(k)}</span></label>)}
            </fieldset>
            <fieldset className="fg"><legend>{t('pay_with', L)}</legend>
              {PAY_KEYS.map(([k, w]) => <label key={k}><input type="checkbox" name="pay" value={k} defaultChecked={pay.includes(k)} /> {t(w, L)} <span className="ct">{ct(k)}</span></label>)}
            </fieldset>
            <noscript><button className="btn sm" type="submit">{t('show', L)}</button></noscript>
            <a className="btn ghost sm" href={`${b}/search?near=${encodeURIComponent(near)}`}>{t('clear', L)}</a>
          </form>

          <div style={{ minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="bar"><span /><label className="small">{t('sort', L)}{' '}
              <a href={qs({ sort: 'mi' })} aria-current={sort === 'mi' ? 'true' : undefined}>{t('closest_first', L)}</a> · <a href={qs({ sort: 'name' })} aria-current={sort === 'name' ? 'true' : undefined}>{t('az', L)}</a></label></div>
            {view === 'map' && mapPins && (
              <div className="map">
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label={es ? 'Mapa de resultados' : 'Map of results'}>
                  {mapPins.pins.map(({ x, y, r: row }) => (
                    <a key={row.id} href={b + placePath(row)} className={row.badge ? 'v' : ''}><title>{cleanName(row.name).name}, {row.city}</title><circle cx={x} cy={y} r="1.8" /></a>
                  ))}
                  <circle className="me" cx={mapPins.me[0]} cy={mapPins.me[1]} r="2.2" />
                </svg>
                <span className="maplab">{es ? 'Morado = usted · dorado = revisado por la Dra. Labor' : 'Purple = you · gold = checked by Dr. Labor · tap a pin'}</span>
              </div>
            )}
            {err && <p className="empty" role="alert">{es ? 'Algo falló. Intente de nuevo.' : 'Something went wrong loading results. Please try again.'}</p>}
            <div className="results">
              {rows.length === 0 && !err ? (
                <div className="empty"><h3>{t('none_title', L)}</h3><p className="small">{t('none_body', L)}</p><a className="btn sm" href={`${b}/search?near=${encodeURIComponent(near)}`}>{t('clear', L)}</a></div>
              ) : rows.map((x) => {
                const n = cleanName(x.name), ph = splitPhone(x.admissions_phone || x.phone), k = helpKind(x.services);
                return (
                  <article className="res" key={x.id}>
                    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                      <span className={`pill p-${k}`}>{HELP[L][k]}</span>
                      <h3><a href={b + placePath(x)}>{n.name}</a></h3>
                      <p className="meta"><span className="mi">{miles(x.miles, L)}</span> · {x.city}, {x.state}{n.site ? ` · ${n.site}` : ''}</p>
                      {x.badge ? <span className="vb"><i>✓</i>{t('checked_by', L)}</span> : <span className="src">{t('from_samhsa', L)}</span>}
                      <div className="chips">{levels(x.levels_of_care, L).slice(0, 4).map((c) => <span className="chip" key={c}>{c}</span>)}{programs(x.specialties, L).slice(0, 1).map((c) => <span className="chip" key={c}>{c}</span>)}</div>
                    </div>
                    <div className="right">
                      {ph.dial && <TapLink id={x.id} className="phone" dial={ph.dial} />}
                      {ph.ext && <span className="small">{t('ask_ext', L)} {ph.ext}</span>}
                      <a className="btn sm" href={b + placePath(x)}>{t('see_details', L)}</a>
                    </div>
                  </article>
                );
              })}
            </div>
            {(page > 1 || page * PER < total) && (
              <div className="actions" style={{ justifyContent: 'center' }}>
                {page > 1 && <a className="btn ghost sm" href={qs({ page: page - 1 })}>{es ? '← Anteriores' : '← Previous'}</a>}
                <span className="small">{(page - 1) * PER + 1}–{Math.min(page * PER, total)} {es ? 'de' : 'of'} {total}</span>
                {page * PER < total && <a className="btn ghost sm" href={qs({ page: page + 1 })}>{es ? 'Siguientes →' : 'Next →'}</a>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
