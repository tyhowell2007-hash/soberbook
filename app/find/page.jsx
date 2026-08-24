import Find from './Find';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find someone — Sober Book' };

export default function FindPage() {
  return (
    <>
      <div className="mast"><span className="lg">🌱 SOBER BOOK</span>
        <Link href="/wall" className="back">←</Link></div>
      <div className="bar">FIND SOMEONE</div>
      <div className="pad"><Find /></div>
    </>
  );
}
