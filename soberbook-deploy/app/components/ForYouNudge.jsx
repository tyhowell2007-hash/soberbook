'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '../../lib/track';
import '../more/foryou.css';

/* =====================================================================
   "DID YOU KNOW?" — THE FOR YOU NUDGE ON THE WALL. 27 Nov 2026 (Kenny).

   One quiet card that tells a member the For You tab exists, until they
   have opened it once. Then it retires for good.

   The rules, from Kenny's "Right moment resources" doc:
   • Shown only to someone who has never opened For You (sb_fy_seen,
     written by ForYouHub on its first open).
   • On at most TWO days in any seven. Not a slot machine.
   • "Not for me" rests it for 7 days.
   • Tapping it, or opening the tab any other way, ends it.

   ⭐ ALL OF THIS LIVES ON THE PHONE (localStorage). Nothing about who saw
   or dismissed it is stored by us, apart from beta testers' counts-only
   events through track(), like every other beta event.

   ⚠️ Renders nothing on the server and nothing until the effect has
   decided, so the wall never flashes a card and then removes it.
   ===================================================================== */

const SEEN = 'sb_fy_seen';
const SNOOZE = 'sb_fy_snooze_until';
const DAYS = 'sb_fy_nudge_days';
const WEEK = 7 * 86400000;

function get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function set(k, v) { try { localStorage.setItem(k, v); } catch { /* fine */ } }
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export default function ForYouNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (get(SEEN)) return;
    const until = Number(get(SNOOZE) || 0);
    if (until && Date.now() < until) return;
    let days = [];
    try { days = JSON.parse(get(DAYS) || '[]'); } catch { days = []; }
    const now = Date.now();
    const d = today();
    days = days.filter((x) => now - new Date(x + 'T12:00:00').getTime() < WEEK);
    if (!days.includes(d)) {
      if (days.length >= 2) return;
      days.push(d);
      set(DAYS, JSON.stringify(days));
    }
    setShow(true);
    track('nudge.shown', { resource: 'foryou', reason: 'never_opened_for_you' });
  }, []);

  if (!show) return null;

  function notForMe() {
    set(SNOOZE, String(Date.now() + WEEK));
    setShow(false);
    track('nudge.snooze', { resource: 'foryou', reason: 'never_opened_for_you' });
  }

  return (
    <aside className="fy-nudge" aria-label="Did you know">
      <span className="fy-nk">Did you know?</span>
      <p className="fy-nt">Everything Sober Book offers lives in <span className="fy-chip">For You</span></p>
      <p className="fy-ns">Books, care, your resume and more, explained in one place. Make it yours.</p>
      <div className="fy-nb">
        <Link href="/more" className="fy-ngo"
              onClick={() => track('nudge.tap', { resource: 'foryou', reason: 'never_opened_for_you' })}>
          Open <b>For You</b> →
        </Link>
        <button type="button" className="fy-nno" onClick={notForMe}>Not for me</button>
      </div>
    </aside>
  );
}
