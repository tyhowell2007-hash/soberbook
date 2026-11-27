import Link from 'next/link';
import LibraryList from './LibraryList';

/* =====================================================================
   /library — THE LIBRARY. 27 Nov 2026 (Kenny, drop 2).

   Books only. The tools (resume builder, care, meetings) live in For
   You; this page is the reading room, reached from For You. Free books
   read here; AA, NA and government titles open from the publisher's
   own free page. See books.js for why the line sits where it does.
   ===================================================================== */
export const metadata = { title: 'The Library · Sober Book' };

export default function LibraryPage() {
  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back to For You">←</Link>
        <span className="lg">the library</span>
      </div>
      <div className="bar">Free books and guides for recovery</div>
      <div className="pad lb-pad">
        <LibraryList />
      </div>
    </>
  );
}
