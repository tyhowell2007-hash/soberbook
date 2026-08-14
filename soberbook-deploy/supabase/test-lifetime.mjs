/* =====================================================================
   The lifetime total, against a real Postgres.

   What 0010 promises is not "the number adds up". Addition is not the
   risky part. What it promises is:

     A total bigger than a day count is a RELAPSE, spelled out in
     arithmetic. So the only thing that must never happen is that
     number reaching somebody who wasn't shown it on purpose.

   And there is a second, quieter promise that is easy to break by
   accident: someone who switches the total OFF must be indistinguishable
   from someone who never had one. If "hidden" and "nothing to hide"
   look different from outside, the switch announces exactly what it was
   built to conceal — and a member who opts out ends up MORE exposed
   than if we'd never built it. That's the case this file exists for.

   Both rules from the earlier tests still apply:

     • Test authorisation WITH DATA IN THE TABLE. An empty table and a
       locked table look identical from outside. Every row is populated
       before anything is asserted.
     • A test over zero rows is not a test. Every loop prints its
       denominator.

   Run: node supabase/test-lifetime.mjs
   ===================================================================== */
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failures = 0;
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};

/* Four people, chosen so every branch of the CASE has a body in it. */
const SHOWN  = '11111111-1111-1111-1111-111111111111'; // relapsed, shows it
const HIDDEN = '22222222-2222-2222-2222-222222222222'; // relapsed, hides it
const CLEAN  = '33333333-3333-3333-3333-333333333333'; // never relapsed, switch ON
const NODATE = '44444444-4444-4444-4444-444444444444'; // total, but no sober date

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
    is_admin boolean not null default false,
    suspended_at timestamptz,
    created_at timestamptz not null default now(),
    constraint lifetime_days_sane check (lifetime_days >= 0 and lifetime_days <= 40000)
  );
  create table blocks (
    blocker_id uuid not null references profiles(id) on delete cascade,
    blocked_id uuid not null references profiles(id) on delete cascade,
    primary key (blocker_id, blocked_id)
  );

  -- stand-in for auth.uid(). A table so the test can change who "you" are.
  create table _who (id uuid);
  create or replace function current_uid() returns uuid
    language sql stable as $$ select id from _who limit 1 $$;
  -- the function runs as the CALLER inside a view, so anon must be able
  -- to read this or the anon test would pass for the wrong reason.
  grant select on _who to authenticated, anon;
`);

/* The view exactly as 0010 defines it. */
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
    pr.anthem_url, pr.anthem_title, pr.anthem_art, pr.anthem_preview,
    (pr.id = current_uid()) as is_mine,
    pr.created_at as joined_at,
    pr.anthem_youtube as anthem_youtube,
    case when pr.show_lifetime and pr.lifetime_days > 0
         then pr.lifetime_days
              + case when pr.sober_since is null then 0
                     else (current_date - pr.sober_since) end
         else null end as total_days
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

/* DATA FIRST — nothing is asserted against an empty table. */
await db.exec(`
  insert into profiles (id, handle, sober_since, lifetime_days, show_lifetime, privacy_mode) values
    ('${SHOWN}',  'Shown',  current_date - 12,  1835, true,  'open'),
    ('${HIDDEN}', 'Hidden', current_date - 12,  1835, false, 'open'),
    ('${CLEAN}',  'Clean',  current_date - 400, 0,    true,  'open'),
    ('${NODATE}', 'Nodate', null,               600,  true,  'open');
`);

const be = async (id) => db.exec(`delete from _who; insert into _who values ('${id}')`);
const asMember = async (sql) => {
  await db.exec('set role authenticated');
  try { return await db.query(sql); }
  finally { await db.exec('reset role'); }
};
const asAnon = async (sql) => {
  await db.exec('set role anon');
  try { return await db.query(sql); }
  finally { await db.exec('reset role'); }
};

console.log('\n--- the total only appears when it was switched on ---');
await be(CLEAN);   // look as somebody uninvolved

const rows = (await asMember(
  `select handle, day_count, total_days from public_profiles order by handle`)).rows;
console.log(`    (${rows.length} profiles read)`);
check('4 profiles came back', rows.length === 4, `got ${rows.length}`);

const by = Object.fromEntries(rows.map(r => [r.handle, r]));

check('opted in → total is current + history',
  by.Shown.total_days === 1847,
  `day_count=${by.Shown.day_count} total=${by.Shown.total_days} (expect 12 + 1835)`);

check('opted OUT → total is null, not the number',
  by.Hidden.total_days === null,
  `got ${by.Hidden.total_days}`);

/* THE ONE THAT MATTERS MOST. Hidden and Clean must be identical from
   outside despite one having 1,835 days of history and the other none. */
check('hidden is INDISTINGUISHABLE from never-relapsed',
  by.Hidden.total_days === by.Clean.total_days && by.Hidden.total_days === null,
  `hidden=${by.Hidden.total_days} clean=${by.Clean.total_days}`);

check('switch on but no history → still null, never 0',
  by.Clean.total_days === null, `got ${by.Clean.total_days}`);

check('no sober date → total is the history alone',
  by.Nodate.total_days === 600 && by.Nodate.day_count === null,
  `day_count=${by.Nodate.day_count} total=${by.Nodate.total_days}`);

console.log('\n--- the switch itself never leaves the server ---');
const cols = (await db.query(
  `select column_name from information_schema.columns
    where table_name = 'public_profiles'`)).rows.map(r => r.column_name);
console.log(`    (${cols.length} columns on the view)`);
check('show_lifetime is not a column on the view',
  !cols.includes('show_lifetime'), cols.join(','));
check('lifetime_days (the raw number) is not exposed either',
  !cols.includes('lifetime_days'));
check('total_days is', cols.includes('total_days'));

console.log('\n--- a blocked person sees nothing at all, total included ---');
await db.exec(`insert into blocks values ('${SHOWN}','${CLEAN}')`);
await be(CLEAN);
const blocked = (await asMember(
  `select handle, total_days from public_profiles where handle_key = 'shown'`)).rows;
console.log(`    (${blocked.length} rows returned for a blocked handle)`);
check('blocked → no row, so no total', blocked.length === 0);
await db.exec(`delete from blocks`);

console.log('\n--- with no account, nothing ---');
let denied = false;
try { await asAnon(`select total_days from public_profiles`); }
catch (e) { denied = /permission denied/i.test(e.message); }
check('anon is refused by the view', denied);

console.log('\n--- the sanity range holds ---');
let rejected = 0, attempts = 0;
for (const bad of [-1, 40001, 999999]) {
  attempts++;
  try { await db.query(`update profiles set lifetime_days = ${bad} where id = '${SHOWN}'`); }
  catch { rejected++; }
}
console.log(`    (${attempts} absurd values attempted)`);
check('every out-of-range total was refused', rejected === attempts,
  `${rejected}/${attempts}`);

const still = (await db.query(
  `select lifetime_days from profiles where id = '${SHOWN}'`)).rows[0].lifetime_days;
check('and the real value survived the attempts', still === 1835, `got ${still}`);

console.log(failures === 0
  ? '\nAll good — the total adds up and the switch actually hides.\n'
  : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
