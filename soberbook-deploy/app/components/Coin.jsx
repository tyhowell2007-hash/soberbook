/* =====================================================================
   ONE RECOVERY COIN, drawn.  31 Oct 2026 (0195).

   Four coins, each with its own metal AND its own engraving, so they read
   apart without colour (Ty approved this look in prototype v3):
     support  · I see you    · bronze · two hands round a flame
     strength · Keep going   · silver · a trail up a hill
     proud    · Proud of you · gold   · the Sober Book sunrise
     metoo    · Me too       · green  · two linked rings

   🔴 THESE ARE ORIGINAL DESIGNS. Never the circle-and-triangle or any
   fellowship's medallion — those belong to somebody else.

   ⚠️ No hooks and no 'use client', so a server page can draw one too. The
   gradient ids are per-kind and identical every time a kind is drawn, so
   twenty gold coins on one wall share one definition rather than fighting.
   ===================================================================== */

const METAL = {
  support:  ['#F3CF9C', '#B97A3C', '#5E3714', '#2B1806', 'rgba(40,20,4,.72)'],
  strength: ['#FFFFFF', '#B9BEC4', '#4E545B', '#22262B', 'rgba(20,24,28,.72)'],
  proud:    ['#FFF4C2', '#E0B23E', '#7A520A', '#2B1A02', 'rgba(58,39,6,.75)'],
  metoo:    ['#E4FCEE', '#4FA77A', '#0B3022', '#04190F', 'rgba(6,35,26,.78)'],
};

function Engraving({ kind, ink }) {
  const g = { fill: 'none', stroke: ink, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'support') {
    return (
      <g {...g}>
        <path d="M50 30c-6 8-9 13-9 19a9 9 0 0 0 18 0c0-6-3-11-9-19z" fill={ink} fillOpacity=".35" />
        <path d="M30 56c3 10 10 16 20 16s17-6 20-16" />
      </g>
    );
  }
  if (kind === 'strength') {
    return (
      <g {...g}>
        <path d="M24 68l18-24 10 12 8-10 16 22z" fill={ink} fillOpacity=".25" />
        <path d="M44 66c2-6 6-8 8-12s4-8 6-10" strokeDasharray="3 6" />
      </g>
    );
  }
  if (kind === 'proud') {
    return (
      <g {...g}>
        <path d="M28 62h44" />
        <path d="M36 62a14 14 0 0 1 28 0" fill={ink} fillOpacity=".38" />
        <path d="M50 30v7M33 37l5 5M67 37l-5 5M27 51h6M67 51h6" />
      </g>
    );
  }
  return (
    <g {...g} strokeWidth="5.5">
      <circle cx="41" cy="50" r="14" />
      <circle cx="59" cy="50" r="14" />
    </g>
  );
}

export default function Coin({ kind, size = 24, className = '', title }) {
  const m = METAL[kind] || METAL.proud;
  const id = `sbcoin-${kind in METAL ? kind : 'proud'}`;
  return (
    <svg className={'sbcoin ' + className} width={size} height={size} viewBox="0 0 100 100"
         role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}
         aria-label={title} focusable="false">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={m[0]} />
          <stop offset=".55" stopColor={m[1]} />
          <stop offset="1" stopColor={m[2]} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} stroke={m[3]} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.6" strokeDasharray="2.4 2.4" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
      <Engraving kind={kind} ink={m[4]} />
    </svg>
  );
}
