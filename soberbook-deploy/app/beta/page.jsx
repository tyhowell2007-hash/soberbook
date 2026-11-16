import Link from 'next/link';
import Lab from './Lab';
import './beta.css';

/* /beta — Beta Lab (0206, Kenny's plan). Testers only: my_beta_lab()
   answers null for everyone else and the page says so. */
export const metadata = { title: 'Beta Lab', robots: { index: false, follow: false } };

export default function BetaPage() {
  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back">←</Link>
        <span className="lg">beta lab</span>
      </div>
      <div className="pad"><Lab /></div>
    </>
  );
}
