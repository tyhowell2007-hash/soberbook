'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchStates, fetchCities, search, levels, specs, certs,
  tel, phoneText, FILTERS, REPORT_REASONS, reportListing, checkedText,
} from '../../lib/centers';

/* =====================================================================
   FIND CARE.

   ⚠️ THE RULE THIS PAGE IS BUILT AROUND: an empty list and a broken
   query must NEVER look the same. Somebody opens this because they are
   trying to get themselves or somebody else into treatment. "No places
   found" when the truth is "the search failed" tells that person there
   is nothing near them, which is the single worst thing this page could
   do. Every failure below says so in words, and offers the SAMHSA
   helpline instead of a dead end.

   ⚠️ Nothing here sorts by anything anybody can buy. There is no
   featured column in the database to sort by — see 0167.
   ===================================================================== */

const PER = 25;
const TOTAL_IN_DIRECTORY = 19490;

export default function FindCare({ snapshot }) {
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [state,  setState]  = useState('');
  const [city,   setCity]   = useState('');
  const [q,      setQ]      = useState('');
  const [on,     setOn]     = useState({});
  const [rows,   setRows]   = useState([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(0);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');

  useEffect(() => {
    fetchStates().then(setStates).catch(() => setErr('states'));
  }, []);

  useEffect(() => {
    setCity('');
    if (!state) { setCities([]); return; }
    fetchCities(state).then(setCities).catch(() => setCities([]));
  }, [state]);

  const run = useCallback(async (nextPage) => {
    if (!state && !q.trim()) { setRows([]); setTotal(0); setErr(''); return; }
    setBusy(true); setErr('');
    try {
      const r = await search({ state, city, q, on, page: nextPage, per: PER });
      if (nextPage === 0) setRows(r.rows);
      else setRows((prev) => prev.concat(r.rows));
      setTotal(r.total);
      setPage(nextPage);
    } catch {
      /* 🔴 The list is NOT cleared on failure. Wiping the results and
         showing an error is two bad messages at once; keeping what was
         already on screen and saying the refresh failed is one. */
      setErr('search');
    } finally { setBusy(false); }
  }, [state, city, q, on]);

  /* Debounced on the typed query; immediate on every other control,
     because a tap should feel like it did something. */
  useEffect(() => {
    const t = setTimeout(() => run(0), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [state, city, q, on]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));
  const chosen = state || q.trim();

  return (
    <div className="fc">
      {/* ⭐ HER NAME IS IN THE FIRST LINE, NOT THE FOOTER, AND THAT IS TY'S
          CALL (18 Sept). Dr. Labor recovers out loud and agreed to it.

          ⚠️ WHAT THIS LINE CLAIMS AND WHAT IT DOESN'T. It says she built
          the directory, which is true. It does NOT say she endorses Sober
          Book, because she hasn't publicly, and /help's own rule is that
          the app does not make claims on somebody else's behalf. If she
          gives a quote, put it here in her words instead of ours. */}
      <p className="fc-intro">
        <b>{TOTAL_IN_DIRECTORY.toLocaleString()} places</b> to get help — the{' '}
        <a href="/rm">RecoveryMap</a>
        {' '}directory, built by <b>Dr. Nicole Labor</b>.
        {' '}Nobody paid to be on this list, and nobody can.
      </p>

      <div className="fc-controls">
        <select className="fc-sel" value={state} onChange={(e) => setState(e.target.value)}
                aria-label="State">
          <option value="">Choose a state…</option>
          {states.map((s) => (
            <option key={s.state} value={s.state}>{s.state} — {s.n}</option>
          ))}
        </select>

        <select className="fc-sel" value={city} onChange={(e) => setCity(e.target.value)}
                disabled={!cities.length} aria-label="City">
          <option value="">{cities.length ? 'Any city' : 'City'}</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>{c.city} — {c.n}</option>
          ))}
        </select>

        <input className="fc-q" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search by name, town or ZIP" aria-label="Search" />
      </div>

      <div className="fc-filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button"
                  className={'fc-chip' + (on[f.key] ? ' is-on' : '')}
                  aria-pressed={!!on[f.key]}
                  onClick={() => toggle(f.key)}>{f.label}</button>
        ))}
      </div>

      {err === 'states' && (
        <div className="fc-down">
          <b>We couldn&apos;t load the list of states.</b>
          <p>This is us, not you. The places are still there — try again in a minute,
             or call <a href="tel:+18006624357">1-800-662-4357</a>, SAMHSA&apos;s free
             helpline, which is staffed 24 hours.</p>
        </div>
      )}
      {err === 'search' && (
        <div className="fc-down">
          <b>The search didn&apos;t come back.</b>
          <p>This is a problem on our end, not an empty result — there may well be
             places near you. Try again, or call{' '}
             <a href="tel:+18006624357">1-800-662-4357</a> (SAMHSA, free, 24 hours).</p>
        </div>
      )}

      {!chosen && !err && (
        <p className="fc-hint">Pick a state, or type a town or ZIP code.</p>
      )}

      {chosen && !err && !busy && total === 0 && (
        <p className="fc-hint">
          Nothing matched that. Try clearing a filter, or widening to the whole state.
        </p>
      )}

      {total > 0 && (
        <p className="fc-count">
          {total.toLocaleString()} {total === 1 ? 'place' : 'places'}
          {city ? ` in ${city}` : state ? ` in ${state}` : ''}
        </p>
      )}

      <ul className="fc-list">
        {rows.map((c) => {
          const lv = levels(c.levels_of_care);
          const sp = specs(c.specialties);
          const ce = certs(c.certifications);
          const dial = tel(c.phone);
          return (
            <li key={c.id} className="fc-card">
              <h3 className="fc-name">{c.name}</h3>
              <div className="fc-where">
                {c.address_line1 ? <>{c.address_line1}<br /></> : null}
                {c.city}, {c.state} {c.zip}
              </div>

              {lv.length > 0 && (
                <div className="fc-tags">
                  {lv.map((t) => (
                    <span key={t} className={'fc-tag' + (t === 'Medication (MAT)' ? ' is-mat' : '')}>{t}</span>
                  ))}
                </div>
              )}

              {(c.accepts_medicaid || c.sliding_scale) && (
                <div className="fc-pays">
                  {c.accepts_medicaid ? <span className="fc-pay">Takes Medicaid</span> : null}
                  {c.sliding_scale ? <span className="fc-pay">Sliding scale</span> : null}
                </div>
              )}

              {sp.length > 0 && <div className="fc-spec">{sp.join(' · ')}</div>}
              {ce.length > 0 && <div className="fc-cert">{ce.join(' · ')}</div>}

              {/* ⚠️ A dead button is worse than plain text. If tel() couldn't
                  build a real dial string, the number is printed instead. */}
              {dial
                ? <a className="fc-call" href={dial}>Call {phoneText(c.phone)}</a>
                : c.phone ? <div className="fc-callx">{phoneText(c.phone)}</div> : null}

              <Update center={c} />
            </li>
          );
        })}
      </ul>

      {rows.length > 0 && rows.length < total && (
        <button type="button" className="fc-more" disabled={busy}
                onClick={() => run(page + 1)}>
          {busy ? 'Loading…' : `Show more (${(total - rows.length).toLocaleString()} left)`}
        </button>
      )}

      {/* ⚠️ THE DATE IS NOT DECORATION. This is a copy, not a live feed.
          A directory that hides its own age sends somebody to a number
          that stopped working. */}
      <p className="fc-foot">
        Checked {snapshot}. Directory by Dr. Nicole Labor&apos;s{' '}
        <a href="/rm">RecoveryMap</a>,
        a project of the Laborhood Change Project. Sober Book doesn&apos;t take
        money from treatment centres and never will.
      </p>
    </div>
  );
}

/* =====================================================================
   "LAST CHECKED · UPDATE THIS LISTING" — 0193, 29 Oct 2026.

   Every card says when its listing was last checked, and anybody who
   finds it wrong can say so in two taps. Reports go to Ty at
   /admin/listings; when he marks one fixed, this date moves to that day.

   ⚠️ "Checked", never "verified". Sober Book doesn't vouch for any
   provider, and the word would say it does.

   ⚠️ This never asks whether a call happened or how it went. Knowing who
   rang which treatment centre is exactly the record this app refuses to
   keep, and the form only asks about the listing.
   ===================================================================== */
function Update({ center }) {
  const [open, setOpen]     = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote]     = useState('');
  const [state, setState]   = useState('');   // '' | 'sending' | 'sent' | 'failed'
  const when = checkedText(center.snapshot_on);

  async function send(e) {
    e.preventDefault();
    if (!reason || state === 'sending') return;
    setState('sending');
    try {
      await reportListing(center.id, reason, note);
      setState('sent');
    } catch {
      /* The form stays open with what they typed. Losing somebody's note
         because the network blinked is the cheap way to make sure they
         never send another one. */
      setState('failed');
    }
  }

  if (state === 'sent') {
    return (
      <p className="fc-upd-done" role="status">
        Thanks. We&apos;ll check it and fix the listing.
      </p>
    );
  }

  return (
    <div className="fc-upd">
      <p className="fc-upd-line">
        {when ? <>Last checked {when} · </> : null}
        <button type="button" className="fc-upd-link" aria-expanded={open}
                onClick={() => setOpen((o) => !o)}>Update this listing</button>
      </p>

      {open && (
        <form className="fc-upd-form" onSubmit={send}>
          <fieldset>
            <legend>What&apos;s wrong with this listing?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.key} className={'fc-upd-opt' + (reason === r.key ? ' is-on' : '')}>
                <input type="radio" name={'why-' + center.id} value={r.key}
                       checked={reason === r.key} onChange={() => setReason(r.key)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea className="fc-upd-note" value={note} maxLength={500} rows={2}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything that would help us fix it (optional)"
                    aria-label="Note (optional)" />
          <p className="fc-upd-anon">Your name isn&apos;t attached. We check it and fix the listing.</p>
          {state === 'failed' && (
            <p className="fc-upd-err" role="alert">That didn&apos;t send. Try again in a minute.</p>
          )}
          <div className="fc-upd-acts">
            <button type="submit" className="fc-upd-send" disabled={!reason || state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send to the team'}
            </button>
            <button type="button" className="fc-upd-cancel"
                    onClick={() => { setOpen(false); setState(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
