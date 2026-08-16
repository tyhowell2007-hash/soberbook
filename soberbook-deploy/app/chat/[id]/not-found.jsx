import Link from 'next/link';

/* Deliberately the same page for four different situations: no such
   thread, a thread you were never in, one you ignored, and one with
   somebody who blocked you.

   The Aug 6 lesson, again: an error message is an output channel. "You
   were blocked" and "that person ignored you" are both facts a harasser
   would pay for. So none of them are distinguishable from a typo. */
export default function NotFound() {
  return (
    <>
      <div className="mast">
        <Link href="/chat" className="back" aria-label="Back to chat">‹</Link>
        <span className="lg">🌱 SOBER BOOK</span>
      </div>
      <div className="pad">
        <div className="empty">
          <div className="h">Nothing here</div>
          <p className="p">This conversation isn&apos;t available.</p>
          <p className="p"><Link href="/chat" className="wholink">Back to chat</Link></p>
        </div>
      </div>
    </>
  );
}
