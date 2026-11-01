/* =====================================================================
   RECOVERYMAP — the words.  31 Oct 2026.

   Everything a visitor reads that comes from SAMHSA's codes is turned
   into plain English (and Spanish) here, in ONE place, so the search,
   the place pages and the guide can never disagree.

   🔴 Anything NOT in these maps is DROPPED, never printed raw. The old
   site printed "Iop", "JOINT_COMMISSION Certified" and "GU" to people
   looking for help. Silence beats jargon.

   🔴 SAMHSA's women_only / men_only mean "HAS A PROGRAM FOR women/men",
   not "women only". 6,764 listings carry both. Never say "only".

   ⚠️ No 'use client' here, deliberately (same as lib/centers.js): it is
   imported by server AND client components.
   ===================================================================== */

/* Dr. Labor has not yet approved the plain-English explanations, the
   Narcan steps, the "Start here for…" tips or the Ask the Doc answers.
   While this is false, those pages carry a small "Draft for Dr. Labor's
   review" ribbon. Flip to true once she signs off. */
export const CONTENT_APPROVED = false;

export const LEVEL = {
  en: {
    detox: 'Detox', residential: 'Live-in treatment', php: 'Day treatment',
    iop: 'Intensive outpatient', outpatient: 'Outpatient', individual_therapy: 'Therapy',
    medication_assisted: 'Medication (MAT)', sober_living: 'Sober living',
  },
  es: {
    detox: 'Desintoxicación', residential: 'Tratamiento residencial', php: 'Tratamiento de día',
    iop: 'Ambulatorio intensivo', outpatient: 'Ambulatorio', individual_therapy: 'Terapia',
    medication_assisted: 'Medicamentos (MAT)', sober_living: 'Vivienda sobria',
  },
};

export const PROGRAM = {
  en: {
    women_only: 'Program for women', men_only: 'Program for men',
    pregnant_postpartum: 'Program for pregnant & new moms', veterans: 'Program for veterans',
    adolescent: 'Program for teens', young_adult: 'Program for young adults',
    lgbtq: 'LGBTQ+ program', trauma_informed: 'Trauma-informed', criminal_justice: 'Program for people coming from court or jail',
    hearing_impaired: 'Deaf & hard of hearing',
  },
  es: {
    women_only: 'Programa para mujeres', men_only: 'Programa para hombres',
    pregnant_postpartum: 'Programa para embarazadas y mamás recientes', veterans: 'Programa para veteranos',
    adolescent: 'Programa para adolescentes', young_adult: 'Programa para adultos jóvenes',
    lgbtq: 'Programa LGBTQ+', trauma_informed: 'Enfoque en trauma', criminal_justice: 'Programa para personas que salen de la corte o la cárcel',
    hearing_impaired: 'Personas sordas',
  },
};

export const CERT = {
  en: { joint_commission: 'Joint Commission accredited', carf: 'CARF accredited', samhsa: 'Opioid treatment program (SAMHSA certified)', state_licensed: 'State licensed' },
  es: { joint_commission: 'Acreditado por la Joint Commission', carf: 'Acreditado por CARF', samhsa: 'Programa de tratamiento de opioides (certificado por SAMHSA)', state_licensed: 'Con licencia estatal' },
};

export const PAY = {
  en: { private: 'Private insurance', medicaid: 'Medicaid', medicare: 'Medicare', tricare: 'TRICARE (military)',
        cash: 'Cash', state: 'State funding', federal_funding: 'Federal grants', samhsa_block_grant: 'Federal grants', ihs_tribal: 'Indian Health Service' },
  es: { private: 'Seguro privado', medicaid: 'Medicaid', medicare: 'Medicare', tricare: 'TRICARE (militar)',
        cash: 'Efectivo', state: 'Fondos estatales', federal_funding: 'Subvenciones federales', samhsa_block_grant: 'Subvenciones federales', ihs_tribal: 'Servicio de Salud Indígena' },
};

export const LANG_NAME = {
  en: { spanish: 'Spanish', sign_language: 'Sign language', chinese: 'Chinese', vietnamese: 'Vietnamese', russian: 'Russian', arabic: 'Arabic' },
  es: { spanish: 'Español', sign_language: 'Lengua de señas', chinese: 'Chino', vietnamese: 'Vietnamita', russian: 'Ruso', arabic: 'Árabe' },
};

export const STATE_NAME = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',
  DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
  PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  PR:'Puerto Rico',GU:'Guam',VI:'U.S. Virgin Islands',MP:'Northern Mariana Islands',AS:'American Samoa',
};

const pick = (map, lang, list) => (list || []).map((c) => map[lang]?.[c] || map.en[c]).filter(Boolean);
export const levels   = (a, lang = 'en') => pick(LEVEL, lang, a);
export const programs = (a, lang = 'en') => pick(PROGRAM, lang, (a || []).filter((c) => c !== 'dual_diagnosis'));
export const certs    = (a, lang = 'en') => pick(CERT, lang, a);
export const pays     = (a, lang = 'en') => [...new Set(pick(PAY, lang, a))];
export const langs    = (a, lang = 'en') => pick(LANG_NAME, lang, a);

/* 'both' | 'su' | 'mh' */
export function helpKind(services) {
  const s = services || [];
  const su = s.includes('substance_use'), mh = s.includes('mental_health');
  return su && mh ? 'both' : su ? 'su' : 'mh';
}
export const HELP = {
  en: { both: 'Drugs, alcohol & mental health', su: 'Drugs & alcohol', mh: 'Mental health' },
  es: { both: 'Drogas, alcohol y salud mental', su: 'Drogas y alcohol', mh: 'Salud mental' },
};
export const HELP_LONG = {
  en: { both: 'Drugs and alcohol, and mental health at the same time', su: 'Drugs and alcohol', mh: 'Mental health (not addiction treatment)' },
  es: { both: 'Drogas y alcohol, y salud mental al mismo tiempo', su: 'Drogas y alcohol', mh: 'Salud mental (no es tratamiento de adicciones)' },
};

/* ---------------------------------------------------------------------
   DISPLAY NAMES. SAMHSA's names were typed for a database: "Pinnacle
   Treatment Centers Oh Xi LLC", "Lighthouse Counseling/Mediation Servs".
   We show a cleaned name and keep the original underneath, so nobody
   calling a place is surprised by what answers the phone.
   ------------------------------------------------------------------- */
const ABBR = [
  [/\bCtr\b/g, 'Center'], [/\bCntr\b/g, 'Center'], [/\bSvcs\b/g, 'Services'], [/\bServs\b/g, 'Services'], [/\bSvc\b/g, 'Service'],
  [/\bHlth\b/g, 'Health'], [/\bBehav\b/g, 'Behavioral'], [/\bTrt\b/g, 'Treatment'], [/\bTrtmt\b/g, 'Treatment'],
  [/\bProg\b/g, 'Program'], [/\bAssoc\b/g, 'Associates'], [/\bComm\b/g, 'Community'], [/\bResid\b/g, 'Residential'],
  [/\bRehab\b/g, 'Rehabilitation'], [/\bCnsl\b/g, 'Counseling'], [/\bCouns\b/g, 'Counseling'], [/\bMed\b/g, 'Medical'],
  [/\bCboc\b/g, 'Outpatient Clinic'], [/\bPhiladelphia\b/g, 'Philadelphia'], [/\bPhilidelphia\b/g, 'Philadelphia'],
  [/\bMh\b/g, 'Mental Health'], [/\bBh\b/g, 'Behavioral Health'], [/\bSa\b/g, 'Substance Abuse'],
];
export function cleanName(raw) {
  if (!raw) return { name: '', site: '', original: '' };
  let [org, site = ''] = raw.split(' — ');
  const tidy = (s) => {
    let t = s;
    for (const [re, to] of ABBR) t = t.replace(re, to);
    t = t.replace(/\s+(Oh|Wv|Pa|Ky|In|Mi)\s+[A-Z][a-z]{0,3}\s+(LLC|Inc)\.?$/i, '')
         .replace(/,?\s+(LLC|Inc|Incorporated|Corp|Co)\.?$/i, '')
         .replace(/\//g, ' & ').replace(/\s{2,}/g, ' ').trim();
    return t;
  };
  org = tidy(org); site = tidy(site);
  if (site && site.toLowerCase() === org.toLowerCase()) site = '';
  return { name: org, site, original: raw, changed: tidy(raw.split(' — ')[0]) !== raw.split(' — ')[0] };
}

/* "304-234-7777 x3221" → { dial: '304-234-7777', ext: '3221' } so the
   call button dials the line and the page says "ask for extension". */
export function splitPhone(p) {
  if (!p) return { dial: '', ext: '' };
  const m = String(p).match(/^(.*?)\s*(?:x|ext\.?)\s*(\d+)\s*$/i);
  return m ? { dial: m[1].trim(), ext: m[2] } : { dial: String(p).trim(), ext: '' };
}
export const telHref = (dial) => 'tel:' + String(dial).replace(/[^\d+]/g, '');

/* Permanent address for a place: /oh/cadiz/southeast-healthcare-cadiz-oh */
export function cityPart(city) {
  return String(city || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}
export const placePath = (c) => `/${String(c.state).toLowerCase()}/${cityPart(c.city)}/${c.slug}`;
export const miles = (m, lang = 'en') =>
  m == null ? '' : m < 1 ? (lang === 'es' ? 'A menos de 1 milla' : 'Under 1 mile') : `${Math.round(m)} ${lang === 'es' ? 'millas' : 'mi'}`;
