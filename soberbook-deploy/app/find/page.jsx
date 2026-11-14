import Find from './Find';
import Link from 'next/link';
import Wordmark from '../components/Wordmark';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find someone — Sober Book' };

export default function FindPage() {
  return (
    <>
      <div className="mast"><Wordmark />
        <Link href="/wall" className="back">←</Link></div>
      <div className="bar">FIND SOMEONE</div>
      <div className="pad"><Find /></div>
    </>
  );
}
