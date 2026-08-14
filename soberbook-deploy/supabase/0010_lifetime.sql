-- =====================================================================
-- 0010 — the number that never resets
--
-- THE PROBLEM, IN ONE COLUMN
--
-- `sober_since` is a single date. The day count is derived from it, so
-- the moment somebody moves that date forward, every day before it is
-- gone. Eight years becomes "Day 1" and the app has no memory that the
-- eight years ever happened.
--
-- Every recovery app on the market does this. It is not an oversight —
-- the streak is an engagement hook, and it works BECAUSE losing it
-- hurts. The pain is the product.
--
-- We are not doing that. The streak stays (it's genuinely motivating),
-- and a LIFETIME TOTAL sits underneath it that nothing can take away:
--
--     Day 12 · 1,847 days total
--
-- This is the rare case where the kind thing and the strange thing are
-- the same thing. No competitor funded by engagement metrics can copy
-- it, because it deliberately removes the sting they depend on.
--
-- ---------------------------------------------------------------------
-- WHY A COLUMN AND NOT A `sober_runs` HISTORY TABLE
--
-- I started to build the table — one row per run, total is a SUM. It's
-- the textbook answer, and it's the wrong one here, for a reason worth
-- writing down:
--
--   THE ENTIRE DAY COUNT IS ALREADY SELF-REPORTED.
--
-- Nobody verifies `sober_since`. A member can type any date they like.
-- So there is no integrity to protect, and a history table would be
-- protecting a number that was never checked in the first place. It
-- would add a table, a policy, a view and a join to guard a claim the
-- person makes about their own life.
--
-- What the table WOULD have bought is a count of attempts. We
-- deliberately never show that — see below — so it buys nothing.
--
-- One integer, owned and writable by the member, is the honest shape.
--
-- ⚠️ AND NOTE WHAT THIS MEANS: a member CAN set their own total to
-- anything. That is not a hole. It's the same trust we already extend
-- on the sober date, applied consistently. Pretending otherwise would
-- be security theatre.
--
-- ---------------------------------------------------------------------
-- WE NEVER STORE OR SHOW HOW MANY TIMES SOMEBODY STARTED OVER
--
-- The total comforts. A count of attempts shames. "1,847 days total"
-- says you have done this before and you can do it again. "6 attempts"
-- says something else entirely, to the same person, about the same
-- facts. So the number of runs is not stored, cannot be derived, and
-- has nowhere to leak from.
-- =====================================================================

alter table profiles add column if not exists lifetime_days integer not null default 0;

-- A sanity range, not a security control. 40,000 days is about 109
-- years, which is longer than anyone has been alive and sober. This
-- exists to catch a typo or a UI bug turning into an absurd number on
-- somebody's page, not to catch a liar.
alter table profiles drop constraint if exists lifetime_days_sane;
alter table profiles add constraint lifetime_days_sane
  check (lifetime_days >= 0 and lifetime_days <= 40000);

-- =====================================================================
-- WHO SEES IT — Ty's call, Aug 9: the member decides.
--
-- Default FALSE, and that default is the whole safety argument:
--
--   total > current streak  ⇒  there was a previous run
--                           ⇒  there was a relapse.
--
-- The number that comforts you privately is the number that outs you
-- publicly. Anyone who never opens settings must land in the safe
-- state, and the people least likely to open settings are the newest
-- and the most fragile. Same reasoning as privacy_mode defaulting to
-- 'anonymous' back in 0001.
-- =====================================================================
alter table profiles add column if not exists show_lifetime boolean not null default false;

-- Column-level grants ACCUMULATE in Postgres — this adds to the lists
-- from 0002 and 0009 rather than replacing them. (Worth knowing, since
-- the revoke/grant rule for TABLE privileges works the opposite way.)
grant update (lifetime_days, show_lifetime) on profiles to authenticated;

-- Deliberately NOT added to the insert grant from 0002. A brand-new
-- member has no history, so both columns take their defaults and there
-- is nothing to write at signup.


-- ---------------------------------------------------------------------
-- Rebuild the public window.
--
-- ⚠️ `create or replace view` can only APPEND columns. Put the new one
-- anywhere but last and Postgres refuses with
--     cannot change name of view column "is_mine" to "total_days"
-- which is exactly how 0007 failed and how 0009 nearly did. The full
-- select list is repeated so what does and does not come out stays
-- readable in one place.
-- ---------------------------------------------------------------------
create or replace view public_profiles with (security_barrier) as
select
  pr.handle,
  lower(pr.handle)                                          as handle_key,
  case when pr.privacy_mode = 'anonymous' then pr.handle
       else coalesce(pr.display_name, pr.handle) end        as display_name,
  case when pr.privacy_mode = 'anonymous'
       then null else pr.avatar end                         as display_avatar,
  case when pr.sober_since is null then null
       else (current_date - pr.sober_since) end             as day_count,
  pr.anthem_url,
  pr.anthem_title,
  pr.anthem_art,
  pr.anthem_preview,
  (pr.id = current_uid())                                   as is_mine,
  pr.created_at                                             as joined_at,
  pr.anthem_youtube                                         as anthem_youtube,
  -- The total, already added up, and NULL unless it was opted in.
  --
  -- ⚠️ NULL RATHER THAN 0 IS THE POINT. If this returned 0 for people
  -- who chose to hide it, then 0 would mean "hiding something" and the
  -- switch would announce exactly what it was meant to conceal. NULL
  -- comes back for BOTH "I turned it off" and "I have no previous
  -- runs", so the two are indistinguishable from outside. That
  -- ambiguity is the protection, and it is why show_lifetime itself is
  -- never exposed here.
  case when pr.show_lifetime and pr.lifetime_days > 0
       then pr.lifetime_days
            + case when pr.sober_since is null then 0
                   else (current_date - pr.sober_since) end
       else null end                                        as total_days
from profiles pr
where pr.suspended_at is null
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = current_uid() and b.blocked_id = pr.id)
       or (b.blocked_id = current_uid() and b.blocker_id = pr.id)
  );

-- ⚠️ REVOKE FIRST, THEN GRANT. Fourth time this rule has earned its
-- keep. Granting what you want never removes what you didn't ask for,
-- and Supabase attaches default privileges at CREATE time — before any
-- grant of mine runs.
revoke all on public_profiles from public;
revoke all on public_profiles from anon;
revoke all on public_profiles from authenticated;
grant select on public_profiles to authenticated;


-- =====================================================================
-- READ IT BACK. Never trust the statements above; ask the catalog.
--
-- Expect exactly:
--   auth_has  = SELECT
--   anon_has  = -
--   pp_cols   = 13
--   new_cols  = 2
--   updatable = YES
--
-- ⚠️ I FIRST WROTE THAT LAST LINE AS "NO", AND SAID TO STOP IF IT EVER
-- SAID YES. That was wrong, and the mistake is worth keeping:
--
--   is_updatable describes the view's SHAPE, not who may write to it.
--   Any simple view — one table, no aggregates — is auto-updatable, so
--   this says YES and always will. It is not a permission.
--
-- The Aug 7 near-miss needed BOTH halves: the view was updatable AND
-- `authenticated` had been granted UPDATE on it by Supabase's defaults.
-- Shape alone is harmless. The lock is the grant.
--
-- So the real check is the ACL, read from pg_class rather than
-- information_schema (which does not reliably show PUBLIC — the Aug 6
-- lesson). Verified live on Aug 9:
--
--   postgres       arwdDxtm    owner
--   service_role   arwdDxtm    server-side key, never in a browser
--   authenticated  r           SELECT, and nothing else
--   anon           (absent)
--   PUBLIC         (absent)
--
-- Run this any time the view is rebuilt:
--
--   select coalesce(nullif(split_part(a,'=',1),''),'PUBLIC') as who,
--          split_part(split_part(a,'=',2),'/',1)             as privs
--   from pg_class c, unnest(c.relacl::text[]) a
--   where c.relname = 'public_profiles';
--
-- Anything other than `r` next to authenticated, or any row at all for
-- anon or PUBLIC, is the bug.
-- =====================================================================
select
  coalesce((select string_agg(distinct privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_name = 'public_profiles' and grantee = 'authenticated'), '-')  as auth_has,
  coalesce((select string_agg(distinct privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_name = 'public_profiles' and grantee = 'anon'), '-')           as anon_has,
  (select count(*) from information_schema.columns
     where table_name = 'public_profiles')                                     as pp_cols,
  (select count(*) from information_schema.columns
     where table_name = 'profiles'
       and column_name in ('lifetime_days','show_lifetime'))                   as new_cols,
  (select is_updatable from information_schema.views
     where table_name = 'public_profiles')                                     as updatable;
