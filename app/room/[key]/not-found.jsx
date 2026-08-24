import Link from 'next/link';

/* ⚠️ One page for four different reasons: no such room, it closed, the
   host is suspended, or one of you blocked the other. They must look
   identical — "that person blocked you" is a fact a harasser uses to
   work out which of their accounts still work (Aug 6). */
export default function RoomNotFound() {
  return (
    <div className="pad">
      <div className="rm-gone">
        <h2>That room isn’t open.</h2>
        <p>It may have ended, or it may never have been there.</p>
        <Link href="/meetings" className="btn">See what else is on</Link>
      </div>
    </div>
  );
}
