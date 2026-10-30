import Link from 'next/link';

/* =====================================================================
   A CHECK-IN.  0194, 30 Oct 2026.

   What a member sees when Ty or Kenny presses "Reach out" in the queue.

   🔴 IT NEVER SAYS THEY WERE REPORTED. Being told "somebody flagged your
   post" at the worst moment reads as being watched and judged, which is
   the opposite of the point. It says somebody here noticed and cares,
   which is true.

   🔴 THE WORDS ARE FIXED. The same page for everyone, written by a person
   and read by Ty before it shipped. No AI writes to a member here, and
   nothing on this page is recorded: no "opened" stamp, no counter.
   ===================================================================== */

export const metadata = { title: 'Checking in — Sober Book' };

export default function Checkin() {
  return (
    <div className="ck">
      <div className="ck-card">
        <h1>Hey. Checking in on you.</h1>
        <p>
          Somebody at Sober Book saw what you wrote and wanted you to know
          you&apos;re not on your own with it. Nobody here needs you to explain
          anything.
        </p>
        <p>
          If things feel like too much right now, you can call or text{' '}
          <a href="tel:988"><b>988</b></a> any time, day or night. It&apos;s free,
          and you don&apos;t have to be in crisis to use it.
          In Illinois you can also call <a href="tel:+18332346343"><b>833-234-6343</b></a>{' '}
          or text HELP to 833234.
        </p>
        <div className="ck-acts">
          <Link className="ck-btn" href="/now">Open Right now</Link>
          <Link className="ck-btn ghost" href="/meetings">Find a meeting</Link>
        </div>
        <p className="ck-sig">The Sober Book team</p>
      </div>
    </div>
  );
}
