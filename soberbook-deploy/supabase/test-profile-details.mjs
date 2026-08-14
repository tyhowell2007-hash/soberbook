/* =====================================================================
   Bio, town, programs, interests, sponsor — against a real Postgres.

   Five new fields, and four of them are FREE TEXT, which is the most
   dangerous shape of data in an app built on anonymity. A member cannot
   accidentally type their own name into a boolean.

   So this file asks one question over and over: WHEN SOMEBODY IS
   ANONYMOUS, DOES ANY OF IT GET OUT? Every anonymous row below is
   loaded with text that would identify a person instantly, on purpose —
   because a test where the anonymous member left their bio blank would
   pass without proving anything.

   And one question that isn't about anonymity at all: does the sponsor
   badge stay down until somebody has real time?

   Rules still in force:
     • Test authorisation WITH DATA IN THE TABLE.
     • A test over zero rows is not a test. Print the denominators.

   Run: node supabase/test-profile-details.mjs
   ===================================================================== */
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failures = 0;
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};

const OPEN   = '11111111-1111-1111-1111-111111111111'; // open, everything filled
const HIDDEN = '22222222-2222-2222-2222-222222222222'; // ANONYMOUS, everything filled
const SHY    = '33333333-3333-3333-3333-333333333333'; // open, location switched off
const NEWISH = '44444444-4444-4444-4444-444444444444'; // open, sponsor on, only 120 days
const VIEWER = '55555555-5555-5555-5555-555555555555';

await db.exec(`
  create role authenticated;
  create role anon;

  create table profiles (
    id uuid primary key,
    handle text not null,
    display_name text,
    avatar text,
    sober_since date,
    privacy_mode text not null default 'anonymous',
    anthem_url text, anthem_title text, anthem_art text,
    anthem_preview text, anthem_youtube text,
    autoplay_songs boolean not null default false,
    lifetime_days integer not null default 0,
    show_lifetime boolean not null default false,
    bio text, town text, state text,
    show_location boolean not null default false,
    programs text, interests text,
    sponsor_status text not null default 'private',
    is_admin boolean not null default false,
    suspended_at timestamptz,
    created_at timestamptz not null default now(),
    -- the caps from 0011, copied verbatim. Without these the length
    -- test at the bottom would refuse nothing and pass anyway, which is
    -- the exact failure mode this whole file is written against.
    constraint bio_len       check (bio is null or char_length(bio) <= 200),
    constraint town_len      check (town is null or char_length(town) <= 60),
    constraint state_len     check (state is null or char_length(state) <= 40),
    constraint programs_len  check (programs is null or char_length(programs) <= 120),
    constraint interests_len check (interests is null or char_length(interests) <= 120)
  );
  create table blocks (
    blocker_id uuid not null references profiles(id) on delete cascade,
    blocked_id uuid not null references profiles(id) on delete cascade,
    primary key (blocker_id, blocked_id)
  );
  create table _who (id uuid);
  create or replace function current_uid() returns uuid
    language sql stable as $$ select id from _who limit 1 $$;
  grant select on _who to authenticated, anon;
`);

/* The view exactly as 0011 defines it (song columns trimmed for length —
   they are unchanged and covered by test-lifetime.mjs). */
await db.exec(`
  create view public_profiles with (security_barrier) as
  select
    pr.handle,
    lower(pr.handle) as handle_key,
    case when pr.privacy_mode = 'anonymous' then pr.handle
         else coalesce(pr.display_name, pr.handle) end as display_name,
    case when pr.privacy_mode = 'anonymous' then null else pr.avatar end as display_avatar,
    case when pr.sober_since is null then null
         else (current_date - pr.sober_since) end as day_count,
    (pr.id = current_uid()) as is_mine,
    case when pr.show_lifetime and pr.lifetime_days > 0
         then pr.lifetime_days + case when pr.sober_since is null then 0
                                      else (current_date - pr.sober_since) end
         else null end as total_days,
    case when pr.privacy_mode = 'anonymous' then null else pr.bio end as bio,
    case when pr.privacy_mode = 'anonymous' or not pr.show_location then null
         else nullif(concat_ws(', ', nullif(trim(pr.town), ''),
                                     nullif(trim(pr.state), '')), '')
    end as location,
    case when pr.privacy_mode = 'anonymous' then null else pr.programs end as programs,
    case when pr.privacy_mode = 'anonymous' then null else pr.interests end as interests,
    (pr.privacy_mode <> 'anonymous'
     and pr.sponsor_status = 'available'
     and pr.sober_since is not null
     and (current_date - pr.sober_since) >= 365) as sponsor_open
  from profiles pr
  where pr.suspended_at is null
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = current_uid() and b.blocked_id = pr.id)
         or (b.blocked_id = current_uid() and b.blocker_id = pr.id)
    );

  revoke all on public_profiles from public;
  revoke all on public_profiles from anon;
  revoke all on public_profiles from authenticated;
  grant select on public_profiles to authenticated;
`);

/* Every anonymous field below is deliberately identifying. */
const DOXX = 'Crane operator at Novelis, dad of two, you know me from the Tuesday group';

await db.exec(`
  insert into profiles
    (id, handle, display_name, avatar, sober_since, privacy_mode,
     bio, town, state, show_location, programs, interests, sponsor_status) values
    ('${OPEN}',  'Open',  'Ty Howell', '🌱', current_date - 900, 'open',
     'In recovery and open about it.', 'Cadiz', 'Ohio', true,
     'AA · SMART · MAT friendly', 'Fishing · Gaming · Podcasts', 'available'),
    ('${HIDDEN}','Hidden','Real Name', '🎸', current_date - 900, 'anonymous',
     '${DOXX}', 'Cadiz', 'Ohio', true,
     'AA Tuesday 7pm St Paul basement', 'Restores 1970 Chevelles', 'available'),
    ('${SHY}',   'Shy',   'Sam',       '🐟', current_date - 900, 'open',
     'Just here to listen.', 'Cadiz', 'Ohio', false, 'MAT', 'Fishing', 'private'),
    ('${NEWISH}','Newish','Dana',      '🌤', current_date - 120, 'open',
     'Ninety days in.', 'Steubenville', 'Ohio', true, 'AA', 'Reading', 'available'),
    ('${VIEWER}','Viewer','V', null, null, 'open', null, null, null, false, null, null, 'private');
`);

const be = async (id) => db.exec(`delete from _who; insert into _who values ('${id}')`);
const asMember = async (sql) => {
  await db.exec('set role authenticated');
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
};

await be(VIEWER);
const rows = (await asMember(
  `select handle, display_name, display_avatar, bio, location, programs, interests,
          sponsor_open, day_count
     from public_profiles order by handle`)).rows;
console.log(`\n    (${rows.length} profiles read as a stranger)`);
check('all 5 profiles came back', rows.length === 5, `got ${rows.length}`);
const by = Object.fromEntries(rows.map(r => [r.handle, r]));

console.log('\n--- anonymous: not one field escapes ---');
const h = by.Hidden;
const leaked = Object.entries({
  display_name: h.display_name, display_avatar: h.display_avatar, bio: h.bio,
  location: h.location, programs: h.programs, interests: h.interests,
}).filter(([k, v]) => v !== null && v !== 'Hidden');
console.log(`    (6 fields inspected on the anonymous profile)`);
check('bio is null even though it names an employer', h.bio === null, String(h.bio));
check('location is null even with the switch ON', h.location === null, String(h.location));
check('programs is null (it named a meeting and a time)', h.programs === null, String(h.programs));
check('interests is null', h.interests === null, String(h.interests));
check('avatar is null', h.display_avatar === null, String(h.display_avatar));
check('name is the handle, not the real name', h.display_name === 'Hidden', h.display_name);
check('NOTHING identifying leaked at all', leaked.length === 0,
  leaked.map(([k]) => k).join(',') || 'clean');

console.log('\n--- the doxxing string appears nowhere in the whole response ---');
const dump = JSON.stringify(rows);
check('no trace of it in any row', !dump.includes('Novelis') && !dump.includes('Chevelles'),
  'searched ' + dump.length + ' chars');

console.log('\n--- open, and the switch on: it shows ---');
check('bio shows', by.Open.bio === 'In recovery and open about it.');
check('town + state joined', by.Open.location === 'Cadiz, Ohio', String(by.Open.location));
check('programs show', by.Open.programs === 'AA · SMART · MAT friendly');

console.log('\n--- open, but the location switch off ---');
check('location withheld', by.Shy.location === null, String(by.Shy.location));
check('while the bio still shows — the switch is location-only',
  by.Shy.bio === 'Just here to listen.', String(by.Shy.bio));

console.log('\n--- the sponsor gate ---');
console.log(`    (Open = ${by.Open.day_count}d, Newish = ${by.Newish.day_count}d)`);
check('900 days + available → badge shows', by.Open.sponsor_open === true);
check('120 days + available → badge does NOT show', by.Newish.sponsor_open === false,
  String(by.Newish.sponsor_open));
check('anonymous + available → no badge either', by.Hidden.sponsor_open === false);
check('not offering → no badge', by.Shy.sponsor_open === false);

console.log('\n--- the private columns never reach the view ---');
const cols = (await db.query(
  `select column_name from information_schema.columns where table_name='public_profiles'`))
  .rows.map(r => r.column_name);
console.log(`    (${cols.length} columns on the view)`);
for (const secret of ['town', 'state', 'show_location', 'privacy_mode',
                      'sponsor_status', 'sober_since', 'id']) {
  check(`${secret} is not exposed`, !cols.includes(secret));
}

console.log('\n--- length caps hold in the database, not just the browser ---');
let rejected = 0, tried = 0, allowed = 0, allowedTried = 0;
for (const [col, n] of [['bio', 201], ['town', 61], ['state', 41],
                        ['programs', 121], ['interests', 121]]) {
  tried++;
  try { await db.query(`update profiles set ${col} = repeat('x', ${n}) where id = '${OPEN}'`); }
  catch { rejected++; }
}
console.log(`    (${tried} over-long values attempted)`);
check('every one refused', rejected === tried, `${rejected}/${tried}`);

/* And the other half, which is the half people forget: prove the cap
   lets legal values THROUGH. A constraint that rejects everything would
   pass the test above and break the app. */
for (const [col, n] of [['bio', 200], ['town', 60], ['state', 40],
                        ['programs', 120], ['interests', 120]]) {
  allowedTried++;
  try { await db.query(`update profiles set ${col} = repeat('x', ${n}) where id = '${OPEN}'`); allowed++; }
  catch { /* refused a legal value */ }
}
console.log(`    (${allowedTried} exactly-at-the-limit values attempted)`);
check('every one accepted', allowed === allowedTried, `${allowed}/${allowedTried}`);

console.log(failures === 0
  ? '\nAll good — anonymous stays anonymous, and the badge waits for a year.\n'
  : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
