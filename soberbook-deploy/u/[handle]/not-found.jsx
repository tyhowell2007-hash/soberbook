import Link from 'next/link';

/* Four different situations land here and they all look the same:
     • no such handle
     • the account is suspended
     • you blocked them
     • they blocked you

   That is deliberate. Any wording that distinguished them would confirm
   the account exists, or announce that somebody took action against
   somebody — and a page is an output channel the same way an error
   message is. So it says the one thing that's true in every case and
   nothing else. */
export default function NotFound() {
  return (
    <>
      <div className="mast">
        <Link href="/wall" className="back" aria-label="Back to the wall">←</Link>
        <span className="lg">🌱 SOBER BOOK</span>
      </div>
      <div className="bar">Nothing here</div>

      <div className="pad">
        <div className="gone">
          <div className="h">No page here.</div>
          <div className="p">
            That handle doesn&apos;t open onto anything.<br />
            Check the spelling, or head back to the wall.
          </div>
        </div>
        <Link href="/wall" className="btn">Back to the wall</Link>
      </div>
    </>
  );
}
