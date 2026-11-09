/* =====================================================================
   RECOVERYMAP — reading SAMHSA's directory for the monthly check.
   6 Nov 2026 (Kenny). Used only by app/api/rm/samhsa/route.js.

   SAMHSA's locator answers "facilities within N meters of a point". A
   state is covered with a grid of 400 km circles over the area where its
   listings already are (rm_samhsa_due gives that box). Anything outside
   the state is dropped.

   🔴 All-or-nothing: if any page fails, the whole state is skipped for
   this run. A half-read state would look like closures and hide real
   listings. The database also refuses a result under 60% of last time.

   ⚠️ No 'use client' — server only.
   ===================================================================== */

const API = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const RADIUS_M = 400000;   // ~249 miles
const STEP_DEG = 4.5;      // grid spacing; every point of the box is within ~3.2° of a center

/* Same key the 6 Nov import used, so those rows are recognised. */
export function keyOf(r) {
  const s = `${r.name1}|${r.street1}|${r.zip}`.toLowerCase();
  let x = 5381;
  for (const c of s) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0;
  return x.toString(16).padStart(8, '0');
}

function grid(box) {
  const pts = [];
  const lat0 = box.min_lat - 1, lat1 = box.max_lat + 1, lng0 = box.min_lng - 1, lng1 = box.max_lng + 1;
  for (let la = lat0; la <= lat1 + STEP_DEG / 2; la += STEP_DEG) {
    const step = STEP_DEG / Math.max(Math.cos((la * Math.PI) / 180), 0.3);
    for (let lo = lng0; lo <= lng1 + step / 2; lo += step) pts.push([Math.min(la, lat1), Math.min(lo, lng1)]);
  }
  return pts;
}

async function getJson(url, deadline) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (Date.now() > deadline) throw new Error('out of time');
    try {
      const r = await fetch(url, {
        cache: 'no-store',
        headers: { 'user-agent': 'RecoveryMap/1.0 (+https://soberbook.app/rm)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
}

/* Every SAMHSA facility in `state`, or throws. */
export async function fetchState(state, box, deadline) {
  const seen = new Map();
  for (const [lat, lng] of grid(box)) {
    let page = 1, pages = 1;
    do {
      const url = `${API}?sAddr=${lat.toFixed(3)},${lng.toFixed(3)}&limitType=2&limitValue=${RADIUS_M}&pageSize=500&page=${page}&sort=0`;
      const j = await getJson(url, deadline);
      pages = j.totalPages || 1;
      for (const r of j.rows || []) {
        if (r.state !== state) continue;
        const k = keyOf(r);
        if (!seen.has(k)) seen.set(k, r);
      }
      page++;
      await new Promise((ok) => setTimeout(ok, 250)); // be polite to SAMHSA
    } while (page <= pages);
  }
  return [...seen.values()];
}

/* ---------------------------------------------------------------------
   SAMHSA row -> a RecoveryMap listing, in the same codes as the rest of
   the table (lib/rm/words.js turns them into plain words).
   ------------------------------------------------------------------- */
const CORRECTIONAL = /correction|jail|prison|detention|sheriff|penitentiary|inmate|incarcerat|\bMCI\b|house of correction|forensic/i;

function phone(p) {
  if (!p) return null;
  const m = String(p).match(/^\D*(\d{3})\D*(\d{3})\D*(\d{4})(.*)$/);
  if (!m) return String(p).trim() || null;
  const ext = (m[4].match(/\d+/) || [''])[0];
  return `${m[1]}-${m[2]}-${m[3]}${ext ? ' x' + ext : ''}`;
}

export function toListing(s) {
  const cat = {};
  for (const x of s.services || []) cat[String(x.f1).trim()] = x.f3 || '';
  const TC = cat['Type of Care'] || '', SET = cat['Service Setting'] || '',
    PAY = cat['Payment/Insurance/Funding Accepted'] || '', PA = cat['Payment Assistance Available'] || '',
    AGE = cat['Age Groups Accepted'] || '', SPG = cat['Special Programs/Groups Offered'] || '',
    LCA = cat['License/Certification/Accreditation'] || '', TAP = cat['Treatment Approaches'] || '',
    LANG = `${cat['Language Services'] || ''}; ${cat['Other Languages'] || ''}`,
    EXCL = cat['Exclusive Services'] || '';
  const otp = s.typeFacility === 'OTP';

  const services = [];
  if (/Substance use treatment|Detoxification/.test(TC) || s.typeFacility === 'SA' || otp) services.push('substance_use');
  if (/Mental health treatment/.test(TC) || s.typeFacility === 'MH') services.push('mental_health');

  const L = [];
  if (/Detox/i.test(TC + SET) || cat['Detoxification (medical withdrawal) Services']) L.push('detox');
  if (/Residential\/24|Short-term residential|Long-term residential|Hospital inpatient/.test(SET)) L.push('residential');
  if (/Partial hospitalization|day treatment/i.test(SET)) L.push('php');
  if (/Intensive outpatient/.test(SET)) L.push('iop');
  if (/Outpatient/.test(SET) || otp) L.push('outpatient');
  if (/Individual psychotherapy/.test(TAP)) L.push('individual_therapy');
  if (/Transitional housing/.test(TC)) L.push('sober_living');
  if (/methadone|buprenorphine|naltrexone/i.test(SET) || cat['Opioid Medications used in Treatment'] || otp) L.push('medication_assisted');

  const SP = [];
  if (/Young Adults/i.test(AGE)) SP.push('young_adult');
  if (/Adult women/.test(SPG)) SP.push('women_only');
  if (/Pregnant\/postpartum/.test(SPG)) SP.push('pregnant_postpartum');
  if (/Adult men/.test(SPG)) SP.push('men_only');
  if (/Veterans/.test(SPG)) SP.push('veterans');
  if (/experienced trauma/.test(SPG)) SP.push('trauma_informed');
  if (/co-occurring/i.test(TC + SPG)) SP.push('dual_diagnosis');
  if (/Adolescents/i.test(AGE + SPG)) SP.push('adolescent');

  const CERT = [];
  if (/Joint Commission/i.test(LCA)) CERT.push('joint_commission');
  if (/\bState\b/.test(LCA)) CERT.push('state_licensed');
  if (/SAMHSA/i.test(LCA)) CERT.push('samhsa');
  if (/Rehabilitation Facilities|CARF/i.test(LCA)) CERT.push('carf');

  const INS = [];
  if (/Medicaid/.test(PAY)) INS.push('medicaid');
  if (/Medicare/.test(PAY)) INS.push('medicare');
  if (/Cash or self-payment/.test(PAY)) INS.push('cash');
  if (/SAMHSA funding/.test(PAY)) INS.push('samhsa_block_grant');
  if (/Federal, or any government funding|Federal Grants/.test(PAY)) INS.push('federal_funding');
  if (/Private health insurance/.test(PAY)) INS.push('private');
  if (/TRICARE/.test(PAY)) INS.push('tricare');
  if (/State-financed|State mental health agency|Other State funds/.test(PAY)) INS.push('state');
  if (/IHS\/Tribal/.test(PAY)) INS.push('ihs_tribal');

  const LG = [];
  if (/Sign language/.test(LANG)) LG.push('sign_language');
  if (/Spanish/.test(LANG)) LG.push('spanish');

  const lab = { substance_use: 'Substance use care', mental_health: 'Mental health care', detox: 'Detox', residential: 'Residential',
    php: 'Day program', iop: 'Intensive outpatient', outpatient: 'Outpatient care', medication_assisted: 'Medication-assisted treatment', sober_living: 'Sober living' };
  const tag = services.map((x) => lab[x])
    .concat(['detox', 'residential', 'php', 'iop', 'outpatient', 'medication_assisted', 'sober_living'].filter((x) => L.includes(x)).map((x) => lab[x]));
  if (SP.includes('veterans')) tag.push('Veterans program');

  const name = [s.name1, s.name2].filter(Boolean).join(' — ');
  let street = [s.street1, s.street2].filter(Boolean).join(', ');
  if (!/\d/.test(street)) street = '';   // SAMHSA sometimes puts program codes here
  const lat = parseFloat(s.latitude), lng = parseFloat(s.longitude);
  const ph = phone(s.phone), adm = phone(s.intake1);

  return {
    key: keyOf(s),
    name,
    slug_base: `${name} ${s.city} ${s.state}`.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    tagline: tag.slice(0, 5).join(' • ') || null,
    address_line1: street || null,
    city: s.city,
    zip: (s.zip || '').slice(0, 5) || null,
    has_address: !!street,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    phone: ph,
    admissions_phone: adm && adm !== ph ? adm : null,
    levels_of_care: L, services, specialties: SP, certifications: CERT, insurance_accepted: INS, languages: LG,
    accepts_insurance: INS.some((x) => ['medicaid', 'medicare', 'private', 'tricare', 'state'].includes(x)) ? true : (PAY ? false : null),
    accepts_medicaid: PAY ? /Medicaid/.test(PAY) : null,
    accepts_medicare: PAY ? /Medicare/.test(PAY) : null,
    sliding_scale: PA || PAY ? /Sliding fee/.test(PA) : null,
    /* Not open to the public, or not useful to someone looking for care. */
    excluded: CORRECTIONAL.test(name) || CORRECTIONAL.test(street) || /DUI\/DWI/.test(EXCL),
  };
}
