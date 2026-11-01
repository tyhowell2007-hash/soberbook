import { base, lang } from '../../../lib/rm/server';
import NearMe from '../NearMe';

export const metadata = { title: 'Recovery housing', description: 'Sober living and Oxford Houses: a safe, sober place to live while you rebuild. MAT-friendly options.' };

/* ⚠️ Oxford Houses (about 4,100) are not loaded yet: the old import
   tool broke when the Oxford House site changed. Until the next drop,
   this page searches the sober-living listings we have and links to
   Oxford House's own vacancy finder, which is live. */
export default function Housing() {
  const b = base(), L = lang(), es = L === 'es';
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}><div className="eyebrow">{es ? 'Vivienda de recuperación' : 'Recovery housing'}</div>
        <h1>{es ? 'Un lugar seguro y sobrio para vivir mientras se reconstruye' : 'A safe, sober place to live while you rebuild'}</h1>
        <p className="lede">{es ? 'La vivienda no es tratamiento, y combina bien con él.' : 'Sober living homes and Oxford Houses. Housing isn’t treatment, and it pairs well with it.'}</p></div>
      <form className="search" action={`${b}/search`} method="get" role="search">
        <input name="near" placeholder={es ? 'Ciudad, estado o código postal' : 'Town, state or ZIP code'} aria-label="Town, state or ZIP code" />
        <input type="hidden" name="level" value="sober_living" />
        <NearMe action={`${b}/search`} label={es ? 'Cerca de mí' : 'Near me'} extra="&level=sober_living" />
        <button className="btn" type="submit">{es ? 'Buscar vivienda' : 'Find sober living'}</button>
      </form>
      <div className="grid2">
        <div className="card teal"><h3>{es ? '¿Toma Suboxone, metadona o Vivitrol?' : 'On Suboxone, methadone or Vivitrol?'}</h3><p>{es ? 'Algunas casas todavía rechazan a personas con medicamentos. Toda Oxford House acepta medicamentos por política nacional.' : 'Some houses still turn people away for it. Every Oxford House welcomes medication by national policy, so they’re a good place to start.'}</p></div>
        <div className="card lav"><h3>Oxford House</h3><p>{es ? 'Casas dirigidas por sus residentes en 46 estados, para hombres o mujeres. Vea las vacantes de hoy en el buscador oficial.' : 'Peer-run houses in 46 states, for men or for women. See today’s openings in Oxford House’s own finder. Coming to RecoveryMap’s search next.'}</p><a className="btn sm" href="https://www.oxfordhouse.org" target="_blank" rel="noopener noreferrer">{es ? 'Buscador de Oxford House' : 'Oxford House finder'}</a></div>
      </div>
      <section style={{ display: 'grid', gap: 12 }}><h2>{es ? 'Cuatro tipos de vivienda' : 'Four kinds of recovery housing'}</h2>
        <div className="levels">
          <div className="lvl"><b>{es ? 'Dirigida por pares' : 'Peer-run'}</b><p>{es ? 'Los residentes la manejan juntos, sin personal pagado. Así funcionan las Oxford House.' : 'Residents run the house together, no paid staff. Oxford Houses work this way.'}</p></div>
          <div className="lvl"><b>{es ? 'Supervisada por encargado' : 'Monitored'}</b><p>{es ? 'Un encargado mantiene las reglas: horarios, pruebas de drogas, reuniones.' : 'A house manager keeps the rules: curfews, drug tests, meetings.'}</p></div>
          <div className="lvl"><b>{es ? 'Con personal' : 'Supervised'}</b><p>{es ? 'Personal capacitado en el lugar. El tratamiento es en otro lugar.' : 'Trained staff on site, with life-skills help. Treatment happens elsewhere.'}</p></div>
          <div className="lvl"><b>{es ? 'Tratamiento y vivienda' : 'Treatment + housing'}</b><p>{es ? 'Atención clínica y vivienda en el mismo lugar.' : 'Clinical care and housing under one roof. The most structure.'}</p></div>
        </div></section>
    </div>
  );
}
