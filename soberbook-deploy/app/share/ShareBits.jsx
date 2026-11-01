'use client';

import { useState } from 'react';
import { browserClient } from '../../lib/supabase-browser';
/* ⚠️ dayLine is copied here, NOT imported from lib/share-card: that file
   pulls in the QR library, which belongs on the server only. */
function dayLine(days) {
  if (days == null) return null;
  if (days === 0) return 'Day one';
  return `Day ${Number(days).toLocaleString('en-US')}`;
}

/* The card, the buttons and the two switches on /share.
   ⚠️ Turning sharing OFF makes soberbook.app/@handle show the same
   "isn't shared right now" page as a handle that doesn't exist. */
export default function ShareBits({ me, svg, url, label }) {
  const [on, setOn] = useState(!!me.on);
  const [showDay, setShowDay] = useState(me.show_day !== false);
  const [msg, setMsg] = useState('');
  const say = (t) => { setMsg(t); clearTimeout(window.__shT); window.__shT = setTimeout(() => setMsg(''), 1600); };

  const save = async (nextOn, nextDay) => {
    const { error } = await browserClient().rpc('set_share_card', { p_on: nextOn, p_show_day: nextDay });
    if (error) { say('Couldn’t save that. Try again.'); return false; }
    return true;
  };
  const flipOn = async () => { const n = !on; if (await save(n, showDay)) { setOn(n); say(n ? 'Your card is shareable' : 'Sharing is off'); } };
  const flipDay = async () => { const n = !showDay; if (await save(on, n)) setShowDay(n); };

  /* Sharing a link turns the card on first, so the person on the other
     end never lands on "isn't shared right now". */
  const ensureOn = async () => { if (on) return true; if (await save(true, showDay)) { setOn(true); return true; } return false; };
  const copy = async () => {
    if (!(await ensureOn())) return;
    try { await navigator.clipboard.writeText(url); say('Link copied'); } catch { say(label); }
  };
  const share = async () => {
    if (!(await ensureOn())) return;
    if (navigator.share) { try { await navigator.share({ title: 'My Sober Book', url }); } catch {} }
    else copy();
  };
  const text = `sms:?&body=${encodeURIComponent('Here’s me on Sober Book: ' + url)}`;

  const name = me.name || '@' + me.handle;
  const day = showDay && me.day_public ? dayLine(me.days) : null;
  return (
    <>
      <div className="shcard" style={{ opacity: on ? 1 : 0.55 }}>
        <span className="shface">{me.avatar || name.replace('@', '').slice(0, 1).toUpperCase()}</span>
        <span className="shname">{name}</span>
        {me.name && <span className="shhandle">@{me.handle}</span>}
        {day && <span className="shday">🌱 {day}</span>}
        <div className="shqr" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="shurl">{label}</span>
      </div>

      <div className="shrow">
        <button type="button" onClick={copy}><i>🔗</i>Copy link</button>
        <a href={text} onClick={ensureOn}><i>💬</i>Text it</a>
        <button type="button" onClick={share}><i>⋯</i>More</button>
      </div>

      <div className="shopt">
        <span>Let people see my card<small>{on ? 'Anyone with the link or QR code can see it.' : 'Off. The link shows nothing about you.'}</small></span>
        <button type="button" className={`shtog${on ? ' shon' : ''}`} aria-pressed={on} aria-label="Let people see my card" onClick={flipOn} />
      </div>
      {me.day_public && (
        <div className="shopt">
          <span>Show my day count<small>Only on this card.</small></span>
          <button type="button" className={`shtog${showDay ? ' shon' : ''}`} aria-pressed={showDay} aria-label="Show my day count" onClick={flipDay} />
        </div>
      )}

      <p className="shfine">
        People who aren’t on Sober Book see {me.anonymous ? 'your @handle' : 'your name, @handle'}{me.day_public ? ' and day count' : ''}, then a button to join.
        Your posts, photos and everything else stay inside the app.
        {me.anonymous ? ' You’re in anonymous mode, so your name and face never show.' : ''}
      </p>
      {msg && <div className="shtoast" role="status">{msg}</div>}
    </>
  );
}
