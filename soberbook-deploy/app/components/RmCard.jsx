import Link from 'next/link';
import './rmcard.css';

/* =====================================================================
   DR. LABOR'S RECOVERYMAP CARD — 1 Nov 2026. Ty saw the prototype
   ("Prototype - RecoveryMap card") and said: "perfect!!"

   One card, used in two places so they can never drift apart:
     • the ☰ drawer (components/MastMenu.jsx)
     • the More page (app/more/page.jsx)

   It wears RecoveryMap's own look (purple, gold phoenix, her name as it
   appears on the site) so tapping it feels like walking into her place,
   not like a Sober Book row. The WHOLE card is the link.

   ⚠️ Claims she built the directory, not that she endorses Sober Book —
   same rule as before (see MastMenu).
   ===================================================================== */
export default function RmCard({ onClick, style }) {
  return (
    <Link href="/rm" className="rmcard" onClick={onClick} style={style}>
      <img src="/rm/icon-192.png" alt="" width="58" height="58" />
      <span className="rmcard-t"><b>RecoveryMap</b><i>by Dr. Nicole Labor, DO</i></span>
      <span className="rmcard-s">
        19,490 places to get help: treatment, detox, sober living and meetings
        near you. Nobody paid to be on it.
      </span>
      <span className="rmcard-go">Find help near you <em>Open →</em></span>
    </Link>
  );
}
