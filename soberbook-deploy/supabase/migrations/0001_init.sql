-- =====================================================================
-- Sober Book — v1 schema
--
-- THE TWO RULES THIS FILE EXISTS TO ENFORCE:
--   1. The client NEVER selects from a base table. Only from the views.
--   2. author_id NEVER reaches a browser for an anonymous post.
--      Ownership is expressed as is_mine, a computed boolean.
--
-- If either rule is broken, nothing visibly fails — the app keeps working
-- and anonymity is silently gone. That is why they are enforced here, at
-- the database, and not in application code.
--
-- See "v1 Build Spec.md" → Decisions for #1 and #2.
-- =====================================================================

-- No extensions required. sha256() and gen_random_uuid() are both core
-- Postgres (11+ and 13+ respectively), so this migration runs anywhere —
-- Supabase, a plain Postgres, or the in-process build used by the test.
-- An earlier draft pulled in pgcrypto for digest(); that was an
-- unnecessary dependency for the same result.

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key,          -- == auth.users.id
  handle        text not null,
  display_name  text,
  avatar        text,                       -- emoji or storage path
  sober_since   date,
  -- default is ANONYMOUS. Someone who never touches settings ends up
  -- protected, not exposed. Defaults are a safety decision here.
  privacy_mode  text not null default 'anonymous'
                check (privacy_mode in ('open','anonymous')),
  anthem_url    text,
  sponsor_status text not null default 'private'
                check (sponsor_status in ('available','has_sponsor','looking','private')),
  timezone      text not null default 'America/New_York',
  is_admin      boolean not null default false,
  suspended_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- handles are case-insensitive-unique, and shaped
create unique index if not exists profiles_handle_lower_idx on profiles (lower(handle));
alter table profiles add constraint handle_shape
  check (handle ~ '^[A-Za-z0-9_]{3,20}$');

-- names people cannot take, because impersonating staff or the product
-- inside a recovery community is a safety problem, not a branding one
create table if not exists reserved_handles (handle text primary key);
insert into reserved_handles (handle) values
  ('admin'),('administrator'),('mod'),('moderator'),('staff'),('support'),
  ('sage'),('soberbook'),('sober_book'),('official'),('help'),('team'),
  ('anonymous'),('anon'),('system'),('root'),('security')
on conflict do nothing;

-- Enforced by trigger, not CHECK: a CHECK constraint cannot contain a
-- subquery, so the reserved list has to be consulted at write time.
create or replace function assert_handle_allowed() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from reserved_handles where handle = lower(new.handle)) then
    raise exception 'handle % is reserved', new.handle;
  end if;
  return new;
end $$;

drop trigger if exists profiles_handle_guard on profiles;
create trigger profiles_handle_guard before insert or update of handle on profiles
  for each row execute function assert_handle_allowed();

-- ---------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------
create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  body           text not null check (length(body) between 1 and 5000),
  photo_url      text,
  is_anonymous   boolean not null default false,
  milestone_days int,
  created_at     timestamptz not null default now()
);
create index if not exists posts_created_idx on posts (created_at desc);

create table if not exists comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts(id) on delete cascade,
  author_id    uuid not null references profiles(id) on delete cascade,
  parent_id    uuid references comments(id) on delete cascade,
  body         text not null check (length(body) between 1 and 2000),
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- reports. NOTE the two kinds: 'concern' means "I'm worried about this
-- person", and it must never sit in the same queue as spam. See spec gap #5.
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile','message')),
  target_id   uuid not null,
  kind        text not null default 'rules'
              check (kind in ('rules','concern')),   -- 'concern' = welfare
  reason      text,
  status      text not null default 'open'
              check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now()
);
create index if not exists reports_triage_idx on reports (kind desc, status, created_at);

-- append-only. break-glass deanonymization writes here and can never be
-- deleted, including by the admin. This is what turns the privacy promise
-- from a claim into a control.
create table if not exists moderation_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references profiles(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  reason      text not null,
  report_id   uuid references reports(id),
  created_at  timestamptz not null default now()
);

create or replace function block_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'moderation_audit is append-only';
end $$;

drop trigger if exists audit_no_update on moderation_audit;
create trigger audit_no_update before update or delete on moderation_audit
  for each row execute function block_audit_mutation();

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists messages (
  id        uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body      text not null check (length(body) between 1 and 5000),
  read_at   timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id     uuid primary key default gen_random_uuid(),
  title  text not null,
  employer text,
  pay    text,
  location text,
  tags   text[],
  url    text,
  -- defaults FALSE so the Aug 3 honesty correction is encoded in the
  -- schema and cannot drift back in by accident
  is_recovery_vetted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sponsor_links (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  sponsor_id uuid not null references profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','confirmed')),
  visibility text not null default 'self' check (visibility in ('all','connections','self')),
  created_at timestamptz not null default now(),
  check (member_id <> sponsor_id),
  unique (member_id, sponsor_id)
);

-- =====================================================================
-- THE ANONYMITY LAYER
-- =====================================================================

-- Per-thread pseudonym.
--   stable  inside one thread  → a conversation is followable
--   different across threads   → nobody can correlate a person app-wide
--   irreversible without the salt, which never leaves the server
--
-- Rendered warm, not as a hex blob: "Anonymous Cedar", not "a7f3b2".
create or replace function anon_alias(thread uuid, author uuid)
returns text
language plpgsql
immutable
as $$
declare
  words text[] := array[
    'Cedar','Sparrow','River','Ember','Birch','Harbor','Willow','Flint',
    'Meadow','Anchor','Juniper','Compass','Aspen','Lantern','Cove','Pine',
    'Wren','Ridge','Hollow','Beacon','Sage','Quarry','Marrow','Thistle'];
  salt text := coalesce(current_setting('app.anon_salt', true), 'CHANGE-ME-IN-PRODUCTION');
  h    bytea;
  idx  int;
begin
  h := sha256(convert_to(thread::text || ':' || author::text || ':' || salt, 'UTF8'));
  idx := (get_byte(h,0) * 256 + get_byte(h,1)) % array_length(words,1) + 1;
  return 'Anonymous ' || words[idx];
end $$;

-- current user, via Supabase auth. Overridden in the local test harness.
create or replace function current_uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ---------------------------------------------------------------------
-- feed_posts — THE ONLY THING THE CLIENT MAY READ FOR POSTS
-- ---------------------------------------------------------------------
create or replace view feed_posts with (security_barrier) as
select
  p.id,
  p.body,
  p.photo_url,
  p.created_at,
  p.milestone_days,
  p.is_anonymous,

  -- NULLED for anonymous. This is the whole ballgame.
  case when p.is_anonymous then null else p.author_id end          as author_id,

  -- ownership without disclosure: the author still gets edit/delete on
  -- their own anonymous post, and nobody else learns a thing
  (p.author_id = current_uid())                                     as is_mine,

  case when p.is_anonymous
       then anon_alias(p.id, p.author_id)
       when pr.privacy_mode = 'anonymous' then pr.handle
       else coalesce(pr.display_name, pr.handle) end                as display_name,

  case when p.is_anonymous or pr.privacy_mode = 'anonymous'
       then null else pr.avatar end                                 as display_avatar,

  (select count(*) from likes l where l.post_id = p.id)             as like_count,
  exists (select 1 from likes l
          where l.post_id = p.id and l.user_id = current_uid())     as liked_by_me,
  (select count(*) from comments c where c.post_id = p.id)          as comment_count

from posts p
join profiles pr on pr.id = p.author_id
where pr.suspended_at is null
  -- blocks enforced ONCE, here, rather than in four separate queries.
  -- Works in both directions and works against authors you cannot see.
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = current_uid() and b.blocked_id = p.author_id)
       or (b.blocked_id = current_uid() and b.blocker_id = p.author_id)
  );

-- comments: same treatment. The Aug 3 note found this was the exact place
-- end-to-end anonymity broke in the demo. It breaks here too if skipped.
-- Alias keys off post_id so an anonymous commenter is consistent within
-- the thread they are actually in.
create or replace view feed_comments with (security_barrier) as
select
  c.id, c.post_id, c.parent_id, c.body, c.created_at, c.is_anonymous,
  case when c.is_anonymous then null else c.author_id end           as author_id,
  (c.author_id = current_uid())                                     as is_mine,
  case when c.is_anonymous
       then anon_alias(c.post_id, c.author_id)
       when pr.privacy_mode = 'anonymous' then pr.handle
       else coalesce(pr.display_name, pr.handle) end                as display_name,
  case when c.is_anonymous or pr.privacy_mode = 'anonymous'
       then null else pr.avatar end                                 as display_avatar
from comments c
join profiles pr on pr.id = c.author_id
where pr.suspended_at is null
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = current_uid() and b.blocked_id = c.author_id)
       or (b.blocked_id = current_uid() and b.blocker_id = c.author_id)
  );

-- Block someone by POST, never by author id — otherwise it is impossible
-- to block the anonymous posts that most need blocking.
-- Honest consequence: this blocks their open account too. Correct, and
-- deliberately NOT explained in the UI, because explaining it is itself
-- a deanonymization hint.
create or replace function block_author_of_post(p_post uuid)
returns void
language plpgsql
security definer
as $$
declare a uuid;
begin
  select author_id into a from posts where id = p_post;
  if a is null or a = current_uid() then return; end if;
  insert into blocks (blocker_id, blocked_id) values (current_uid(), a)
  on conflict do nothing;
end $$;


-- =====================================================================
-- ROW LEVEL SECURITY — ON FOR EVERY TABLE, NO EXCEPTIONS.
--
-- ⚠️ Added Aug 3 after a live audit. The first version of this file only
-- enabled RLS on the tables the app read from, and left threads,
-- messages, moderation_audit, jobs, sponsor_links and reserved_handles
-- open. They looked safe in testing ONLY because they were empty — every
-- one of them returned HTTP 200 with `[]`.
--
-- The moment a private message existed, it would have been readable by
-- anyone with the publishable key, which ships in every page of the site.
--
-- THE LESSON: an empty table and a protected table are indistinguishable
-- from the outside. Test authorisation with data in the table, never
-- without. "It returned nothing" is not "it refused to answer".
-- =====================================================================
alter table threads          enable row level security;
alter table messages         enable row level security;
alter table moderation_audit enable row level security;
alter table jobs             enable row level security;
alter table sponsor_links    enable row level security;
alter table reserved_handles enable row level security;

-- =====================================================================
-- LOCKDOWN — rule 1, enforced
-- =====================================================================
revoke all on posts, comments, profiles, likes, blocks,
              messages, threads, reports, moderation_audit,
              sponsor_links from public;

-- In Supabase, grant these to `authenticated` instead of `public`:
--   grant select on feed_posts, feed_comments to authenticated;
--   grant execute on function block_author_of_post(uuid) to authenticated;
-- Writes go through RLS-protected insert policies or RPC, never raw select.
