'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '../../lib/track';
import BrandName from '../components/BrandName';

/* =====================================================================
   THE FOR YOU HUB — the arrangeable list on /more. 27 Nov 2026.

   ⭐ KEPT ON THIS PHONE, NOT IN OUR DATABASE. The member's order, sizes
   and hidden tools live in localStorage under ONE key. Nothing about
   which recovery tools somebody uses leaves the device. The cost is
   accepted: a new phone starts from the default order.

   ⚠️ localStorage can be missing or throw (private mode, the iOS shell
   on a full disk), so every read and write is wrapped. On failure the
   page simply shows the default order and arranging still works for the
   visit.

   ⚠️ The first render is the default order on the server AND in the
   browser, then the saved arrangement is applied in an effect. Reading
   storage during render would make the server and browser disagree.

   🔴 ARRANGE NEVER TOUCHES 988 OR THE FOOTER. Those live in page.jsx,
   outside this component, so there is no control here that could move
   or hide them.
   ===================================================================== */

const KEY = 'sb_fy_v1';       // { order:[ids], big:{id:bool}, hid:{id:true}, welcomed:true }
const SEEN = 'sb_fy_seen';    // set on first open; the wall's nudge reads it

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function save(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* fine */ }
}

export default function ForYouHub({ tools = [] }) {
  const ids = tools.map((t) => t.id);
  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
  const defaults = {
    order: ids,
    big: Object.fromEntries(tools.filter((t) => t.big).map((t) => [t.id, true])),
    hid: {},
    welcomed: false,
  };
  const [st, setSt] = useState(defaults);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SEEN, '1'); } catch { /* fine */ }
    track('foryou.open');
    const saved = load();
    if (!saved) return;
    /* A tool added after the member arranged goes to the end, shown;
       a tool removed from the app drops out of their order. */
    const known = (saved.order || []).filter((id) => byId[id]);
    const added = ids.filter((id) => !known.includes(id));
    setSt({
      order: [...known, ...added],
      big: saved.big || defaults.big,
      hid: saved.hid || {},
      welcomed: !!saved.welcomed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function put(next) { setSt(next); save(next); }

  function move(id, d) {
    const o = [...st.order];
    const i = o.indexOf(id);
    let j = i + d;
    while (j >= 0 && j < o.length && st.hid[o[j]]) j += d;   // skip hidden ones
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    put({ ...st, order: o });
  }
  const resize = (id) => put({ ...st, big: { ...st.big, [id]: !st.big[id] } });
  const hide = (id) => put({ ...st, hid: { ...st.hid, [id]: true } });
  const unhide = (id) => { const h = { ...st.hid }; delete h[id]; put({ ...st, hid: h }); };
  const reset = () => { put({ ...defaults, welcomed: true }); };

  function startArranging() {
    setEditing(true);
    if (!st.welcomed) put({ ...st, welcomed: true });
    track('foryou.arrange');
  }
  const dismissWelcome = () => put({ ...st, welcomed: true });

  const shown = st.order.filter((id) => !st.hid[id]);
  const hidden = st.order.filter((id) => st.hid[id]);

  return (
    <section className="fy" aria-label="Your tools">
      {!st.welcomed && (
        <div className="fy-welcome" role="note">
          <b className="fy-wt">Welcome to <span className="fy-chip">For You</span></b>
          <p>Here’s everything <BrandName /> offers, with a line on what each one does. Make it yours: move what you use to the top, make it big or small, and hide what you don’t need.</p>
          <div className="fy-wbtns">
            <button type="button" className="fy-go" onClick={startArranging}>Make it mine</button>
            <button type="button" className="fy-later" onClick={dismissWelcome}>Not now</button>
          </div>
        </div>
      )}

      <div className="fy-head">
        <h2 className="fy-h">{editing ? 'Arrange it your way' : 'Your tools'}</h2>
        <button type="button" className={'fy-arr' + (editing ? ' on' : '')} aria-pressed={editing}
                onClick={() => (editing ? setEditing(false) : startArranging())}>
          {editing ? 'Done' : 'Arrange'}
        </button>
      </div>
      {editing && (
        <p className="fy-tip">Use the arrows to move a tool, Big or Small to resize it, and Hide to tuck it away. Hidden tools wait at the bottom. Saved on this phone only.</p>
      )}

      <ul className="fy-grid">
        {shown.map((id, n) => {
          const t = byId[id];
          const big = !!st.big[id];
          const cls = 'fy-tile' + (big ? ' big' : '') + (t.hot ? ' hot' : '');
          return (
            <li key={id} className={cls}>
              {editing ? (
                <div className="fy-in">
                  <b className="fy-t">{t.label}</b>
                  <span className="fy-s">{t.sub}</span>
                  <div className="fy-ctl">
                    <button type="button" aria-label={`Move ${t.label} up`} disabled={n === 0} onClick={() => move(id, -1)}>↑</button>
                    <button type="button" aria-label={`Move ${t.label} down`} disabled={n === shown.length - 1} onClick={() => move(id, 1)}>↓</button>
                    <button type="button" onClick={() => resize(id)}>{big ? 'Small' : 'Big'}</button>
                    <button type="button" className="fy-hide" onClick={() => hide(id)}>Hide</button>
                  </div>
                </div>
              ) : (
                <Link href={t.href} className="fy-in fy-link" onClick={() => track('foryou.tool', { tool: id })}>
                  <b className="fy-t">{t.label}</b>
                  <span className="fy-s">{t.sub}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {hidden.length > 0 && (
        <div className="fy-hidden">
          <h3 className="fy-hh">Hidden · tap to add back</h3>
          <div className="fy-hrow">
            {hidden.map((id) => (
              <button key={id} type="button" className="fy-add" onClick={() => unhide(id)}>+ {byId[id].label}</button>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <button type="button" className="fy-reset" onClick={reset}>Put everything back the way it started</button>
      )}
    </section>
  );
}
