import { browserClient } from './supabase-browser';

/* =====================================================================
   FIND CARE — Dr. Nicole Labor's RecoveryMap directory, read from our
   own copy of it. See supabase/0167–0169.

   ⚠️ NO 'use client' HERE, deliberately — same as lib/circles.js and
   lib/wyr.js. This file is imported BY client components; marking it
   itself would pull it into the client graph twice.
   ===================================================================== */

/* ---------------------------------------------------------------------
   THE VOCABULARY.

   The source ships machine codes — 'iop', 'php', 'medication_assisted'.
   Printing those to somebody looking for help is the same failure as
   printing a raw error: technically accurate, useless to a person.

   ⚠️ Anything NOT in this map is DROPPED, not shown raw. A new code
   appearing upstream should show fewer chips, never a chip reading
   "dual_diagnosis_iop_2". Silence beats jargon here.
   ------------------------------------------------------------------- */
const LEVEL = {
  detox:              'Detox',
  residential:        'Residential',
  php:                'Day treatment',
  iop:                'Intensive outpatient',
  outpatient:         'Outpatient',
  individual_therapy: 'Individual therapy',
  /* 🔴 THE ONE THAT MATTERS MOST ON THIS APP. Sober Book counts
     medication as recovery — "it all counts" is a whole video in the
     slate — so this is the filter people will reach for first. The
     source's own matFriendly boolean is FALSE on all 19,490 rows; this
     code is the true signal, on 9,187. Never read that boolean. */
  medication_assisted: 'Medication (MAT)',
  sober_living:        'Sober living',
};

const SPECIALTY = {
  veterans: 'Veterans', women_only: 'Women only', men_only: 'Men only',
  young_adult: 'Young adults', adolescent: 'Teens',
  pregnant_postpartum: 'Pregnant & postpartum',
  lgbtq: 'LGBTQ+', trauma_informed: 'Trauma informed',
  dual_diagnosis: 'Mental health too', criminal_justice: 'Court involved',
  hearing_impaired: 'Deaf & hard of hearing',
};

const CERT = {
  joint_commission: 'Joint Commission', carf: 'CARF',
  state_licensed: 'State licensed', samhsa: 'SAMHSA', narr: 'NARR',
};

export const label   = (c) => LEVEL[c] || null;
export const levels  = (a) => (a || []).map((c) => LEVEL[c]).filter(Boolean);
export const specs   = (a) => (a || []).map((c) => SPECIALTY[c]).filter(Boolean);
export const certs   = (a) => (a || []).map((c) => CERT[c]).filter(Boolean);

/* The filter row. Kept here rather than in the component so the labels
   and the database parameter names can never drift apart. */
export const FILTERS = [
  { key: 'mat',      label: 'Medication (MAT)', arg: 'p_mat' },
  { key: 'housing',  label: 'Sober living',     arg: 'p_housing' },
  { key: 'medicaid', label: 'Medicaid',         arg: 'p_medicaid' },
  { key: 'sliding',  label: 'Sliding scale',    arg: 'p_sliding' },
];

/* =====================================================================
   THE PHONE, MADE TAPPABLE — and the extension is the whole reason this
   function exists rather than an inline `tel:${phone}`.

   1,739 of 19,490 numbers carry one: "205-941-1799 x29605". Dropped into
   an href raw, the browser dials 20594117991129605 or refuses outright.
   A tel: URL takes commas as PAUSES, so the extension dials itself after
   the call connects.

   ⚠️ Same lesson as lib/meetings.js: the `tel:` SCHEME belongs in this
   function, not at the call site. An href with no scheme is read as a
   RELATIVE PATH — that shipped once and produced a Call button that
   navigated to soberbook.app/+1330... and dialled nothing, silently, for
   four weeks.

   ⚠️ Nothing is invented. No guessed country code beyond the standard
   10-digit US case; if the digits aren't there, we return '' and the
   card shows the number as plain text instead of a dead button.
   ===================================================================== */
export function tel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const ext = s.match(/\b(?:x|ext\.?|extension)\s*(\d{1,6})\b/i);
  const head = ext ? s.slice(0, ext.index) : s;
  let num = head.replace(/[^\d]/g, '');
  if (num.length === 11 && num.startsWith('1')) num = num.slice(1);
  if (num.length !== 10) return '';
  let out = 'tel:+1' + num;
  if (ext) out += ',,' + ext[1];
  return out;
}

/* How the number should READ on the card — the extension kept visible,
   because somebody dialling by hand from a landline still needs it. */
export function phoneText(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{3})[^\d]*(\d{3})[^\d]*(\d{4})(.*)$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}${m[4] ? ' ' + m[4].trim() : ''}` : s;
}

/* ---------------------------------------------------------------------
   THE READS. All three are SECURITY DEFINER functions that bail on a
   NULL caller — see 0168. A signed-out caller gets an exception, not an
   empty list, which is the correct failure.
   ------------------------------------------------------------------- */
export async function fetchStates() {
  const { data, error } = await browserClient().rpc('center_states');
  if (error) throw error;
  return data || [];
}

export async function fetchCities(state) {
  if (!state) return [];
  const { data, error } = await browserClient().rpc('center_cities', { p_state: state });
  if (error) throw error;
  return data || [];
}

export async function search({ state, city, q, on = {}, page = 0, per = 25 }) {
  const { data, error } = await browserClient().rpc('search_centers', {
    p_state: state || null,
    p_city: city || null,
    p_q: (q || '').trim() || null,
    p_mat: !!on.mat,
    p_housing: !!on.housing,
    p_medicaid: !!on.medicaid,
    p_sliding: !!on.sliding,
    p_level: null,
    p_limit: per,
    p_offset: page * per,
  });
  if (error) throw error;
  const rows = data || [];
  /* `total` rides on every row (one window over the same CTE). An empty
     result set therefore has no total — which is 0, not unknown. */
  return { rows, total: rows.length ? Number(rows[0].total) : 0 };
}
