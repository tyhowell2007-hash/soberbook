import Link from 'next/link';
import ShelfList from './ShelfList';

export const metadata = { title: 'My Shelf · The Library' };

/* /library/shelf — MY SHELF. Private, on this phone only, no due dates. */
export default function ShelfPage() {
  return (
    <>
      <div className="mast">
        <Link href="/library" className="back" aria-label="Back to the Library">←</Link>
        <span className="lg">my shelf</span>
      </div>
      <div className="bar">Only you can see this. No due dates.</div>
      <div className="pad lb-pad"><ShelfList /></div>
    </>
  );
}
