/* =====================================================================
   A name and a face — against a real Postgres.

   0012 introduces the first field that could ever carry a PHOTOGRAPH OF
   A PERSON. Nothing is wired to upload one yet, but the column, the
   constraint and the anonymity gate all exist now — so they get tested
   now, while it costs nothing, rather than on the night somebody
   finally builds the upload button at 1am.

   The question this file asks over and over: CAN AN ANONYMOUS MEMBER'S
   FACE GET OUT? Every anonymous row below has a name, an emoji AND a
   photo path set, deliberately. A test where the anonymous member left
   those blank would pass while proving nothing.

   And one that is easy to miss: `avatar_kind` decides which of two
   columns is the real answer. If the view returned both, the browser
   would have to choose — and a decision about what a stranger may see
   does not belong in a browser.

   Run: node supabase/test-identity.mjs
   ===================================================================== */
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failures = 0;
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};

const EMOJI  = '11111111-1111-1111-1111-111111111111'; // open, emoji face
const PHOTO  = '22222222-2222-2222-2222-222222222222'; // open, photo face
const HIDDEN = '33333333-3333-3333-3333-333333333333'; // ANONYMOUS, name+emoji+photo all set
const BARE   = '44444444-4444-4444-4444-444444444444'; // no name, no face — the old default
const VIEWER = '55555555-5555-5555-5555-555555555555';

await db.exec(`
  create role authenticated;
  create role anon;

  create table profiles (
    id uuid primary key,
    handle text not null,
    display_name text,
    avatar text,
    avatar_kind text not null default 'emoji',
    avatar_photo text,
    sober_since date,
    privacy_mode text not null default 'anonymous',
    suspended_at timestamptz,
    created_at timestamptz not null default now(),
    constraint avatar_kind_ok check (avatar_kind in ('emoji','photo','none')),
    constraint avatar_len check (avatar is null or char_length(avatar) <= 8),
    constraint display_name_len check (display_name is null or char_length(display_name) <= 40),
    constraint avatar_photo_shape
      check (avatar_photo is null or avatar_photo ~ '^avatars/[A-Za-z0-9._-]{1,80}$')
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

/* The view as 0012 defines it (fields unrelated to identity trimmed —
   they're unchanged and covered by the earlier tests). */
await db.exec(`
  create view public_profiles with (security_barrier) as
  select
    pr.handle,
    lower(pr.handle) as handle_key,
    case when pr.privacy_mode = 'anonymous' then pr.handle
         else coalesce(pr.display_name, pr.handle) end as display_name,
    case when pr.privacy_mode = 'anonymous' or pr.avatar_kind <> 'emoji'
         then null else pr.avatar end as display_avatar,
    (pr.id = current_uid()) as is_mine,
    case when pr.privacy_mode = 'anonymous' or pr.avatar_kind <> 'photo'
         then null else pr.avatar_photo end as display_avatar_photo
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

await db.exec(`
  insert into profiles (id, handle, display_name, avatar, avatar_kind, avatar_photo, privacy_mode) values
    ('${EMOJI}', 'Emoji',  'Ty',        '🌱', 'emoji', null,                    'open'),
    ('${PHOTO}', 'Photo',  'Dana',      '🎸', 'photo', 'avatars/dana-9f3c.jpg', 'open'),
    ('${HIDDEN}','Hidden', 'Ty Howell', '🎣', 'photo', 'avatars/ty-real.jpg',   'anonymous'),
    ('${BARE}',  'Bare',   null,        null, 'none',  null,                    'open'),
    ('${VIEWER}','Viewer', null,        null, 'none',  null,                    'open');
`);

const be = async (id) => db.exec(`delete from _who; insert into _who values ('${id}')`);
const asMember = async (sql) => {
  await db.exec('set role authenticated');
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
};

await be(VIEWER);
const rows = (await asMember(
  `select handle, display_name, display_avatar, display_avatar_photo
     from public_profiles order by handle`)).rows;
console.log(`\n    (${rows.length} profiles read as a stranger)`);
check('all 5 came back', rows.length === 5, `got ${rows.length}`);
const by = Object.fromEntries(rows.map(r => [r.handle, r]));

console.log('\n--- avatar_kind decides, and only ONE answer ever leaves ---');
check('emoji member: emoji out, photo null',
  by.Emoji.display_avatar === '🌱' && by.Emoji.display_avatar_photo === null,
  `${by.Emoji.display_avatar} / ${by.Emoji.display_avatar_photo}`);
check('photo member: photo out, emoji null EVEN THOUGH one is stored',
  by.Photo.display_avatar === null && by.Photo.display_avatar_photo === 'avatars/dana-9f3c.jpg',
  `${by.Photo.display_avatar} / ${by.Photo.display_avatar_photo}`);
check('nobody ever gets both at once',
  rows.every(r => !(r.display_avatar && r.display_avatar_photo)),
  `checked ${rows.length} rows`);
check('kind "none": no face at all', by.Bare.display_avatar === null
  && by.Bare.display_avatar_photo === null);

console.log('\n--- the anonymous member has a name, an emoji and a photo. none escape ---');
const h = by.Hidden;
check('real name withheld, handle shown instead', h.display_name === 'Hidden', h.display_name);
check('emoji withheld', h.display_avatar === null, String(h.display_avatar));
check('PHOTO withheld', h.display_avatar_photo === null, String(h.display_avatar_photo));
const dump = JSON.stringify(rows);
check('no trace of the real name or the photo path anywhere in the response',
  !dump.includes('Ty Howell') && !dump.includes('ty-real'),
  'searched ' + dump.length + ' chars');

console.log('\n--- the fallback that hid this bug for a week ---');
check('no display_name → the handle stands in', by.Bare.display_name === 'Bare', by.Bare.display_name);
console.log('    (this coalesce is WHY nobody noticed display_name was never written)');

console.log('\n--- the raw columns never reach the view ---');
const cols = (await db.query(
  `select column_name from information_schema.columns where table_name='public_profiles'`))
  .rows.map(r => r.column_name);
console.log(`    (${cols.length} columns on the view)`);
for (const secret of ['avatar','avatar_kind','avatar_photo','privacy_mode','id']) {
  check(`${secret} is not exposed`, !cols.includes(secret));
}

console.log('\n--- the caps hold, both directions ---');
let refused = 0, tried = 0;
const bad = [
  ['avatar', "repeat('x', 9)"],
  ['display_name', "repeat('x', 41)"],
  ['avatar_photo', "'https://evil.example.com/x.jpg'"],
  ['avatar_photo', "'avatars/../../etc/passwd'"],
  ['avatar_kind', "'gif'"],
];
for (const [col, val] of bad) {
  tried++;
  try { await db.query(`update profiles set ${col} = ${val} where id = '${EMOJI}'`); }
  catch { refused++; }
}
console.log(`    (${tried} bad values attempted)`);
check('every one refused', refused === tried, `${refused}/${tried}`);

let ok = 0, okTried = 0;
const good = [
  ['avatar', "repeat('x', 8)"],
  ['display_name', "repeat('x', 40)"],
  ['avatar_photo', "'avatars/a_b-c.1.jpg'"],
  ['avatar_kind', "'none'"],
];
for (const [col, val] of good) {
  okTried++;
  try { await db.query(`update profiles set ${col} = ${val} where id = '${EMOJI}'`); ok++; }
  catch { /* refused something legal */ }
}
console.log(`    (${okTried} legal values attempted)`);
check('every one accepted', ok === okTried, `${ok}/${okTried}`);

console.log(failures === 0
  ? '\nAll good — one face out, never two, and never the anonymous one.\n'
  : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
