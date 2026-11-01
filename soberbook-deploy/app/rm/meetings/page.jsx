import { lang } from '../../../lib/rm/server';

export const metadata = { title: 'Free recovery meetings', description: 'AA, NA, SMART Recovery, Celebrate Recovery, Recovery Dharma, Al-Anon and more: in person and online.' };

/* ⚠️ Tonight's real meeting times (AA's and NA's published lists, pulled
   nightly) come in the next RecoveryMap drop. Until then each finder
   opens the fellowship's own official search, which IS current. */
const M = [
  ['Alcoholics Anonymous (AA)', 'Alcohol · in person and online', 'https://www.aa.org/find-aa'],
  ['Narcotics Anonymous (NA)', 'Drugs · in person and online', 'https://www.na.org/meetingsearch/'],
  ['SMART Recovery', 'Science-based, no higher power · online every day', 'https://www.smartrecovery.org'],
  ['Celebrate Recovery', 'Christ-centered, any hurt or habit', 'https://www.celebraterecovery.com'],
  ['Recovery Dharma', 'Buddhist-inspired, peer-led', 'https://recoverydharma.org'],
  ['Al-Anon', 'For family and friends of people who drink', 'https://al-anon.org'],
  ['Nar-Anon', 'For family and friends of people who use drugs', 'https://www.nar-anon.org'],
  ['In The Rooms', 'Online meetings from many fellowships, any hour', 'https://www.intherooms.com'],
];
export default function Meetings() {
  const es = lang() === 'es';
  return (
    <div className="page">
      <div style={{ display: 'grid', gap: 10 }}><div className="eyebrow">{es ? 'Reuniones' : 'Meetings'}</div><h1>{es ? 'Reuniones gratuitas, en persona y en línea' : 'Free meetings, in person and online'}</h1>
        <p className="lede">{es ? 'Cada enlace abre el buscador oficial de esa comunidad. Pronto: los horarios de esta noche cerca de usted, aquí mismo.' : 'Each one opens that fellowship’s own official meeting finder, which is always current. Coming next: tonight’s meeting times near you, right here.'}</p></div>
      <div className="list">{M.map(([n, d, u]) => (
        <div className="item" key={n}><div><b>{n}</b><p>{d}</p></div><a className="btn sm" href={u} target="_blank" rel="noopener noreferrer">{es ? 'Buscar reunión' : 'Find a meeting'}</a></div>
      ))}</div>
      <div className="card lav"><h3>{es ? 'Centros de recuperación entre pares' : 'Peer recovery centers'}</h3><p>{es ? 'Lugares dirigidos por personas en recuperación: café, un aventón a una reunión, alguien con quien hablar. Estamos armando la lista de Ohio.' : 'Drop-in places run by people in recovery: coffee, a ride to a meeting, someone to talk to. No program needed. We’re building the Ohio list now.'}</p></div>
    </div>
  );
}
