-- =====================================================================
-- 0012 — a name and a face
--
-- THE BUG THIS FIXES IS NOT "you can't change it". It's that NOBODY HAS
-- EVER HAD ONE.
--
-- /welcome collects a handle and nothing else. `display_name` and
-- `avatar` have been NULL for every member since the day the app
-- opened. The views cover for it —
--
--     coalesce(pr.display_name, pr.handle)   as display_name
--     ...pr.avatar...                        as display_avatar   → null
--
-- — so the app never broke and nobody noticed. Ty's own profile card
-- reads TYHOWELL07 because that IS his display name, and every avatar
-- on the Wall falls back to the same seedling.
--
-- A column that is written nowhere and read everywhere fails silently
-- forever. That's the same shape as the .eq() bug and the campaign tag:
-- working software, quietly doing nothing.
--
-- ---------------------------------------------------------------------
-- THREE KINDS OF FACE, ONE COLUMN TO SAY WHICH — Ty's call, Aug 10:
-- the member decides how they show up, including a real photo.
--
-- Designed here in full so photos slot in later without a second
-- migration and without a rebuild of public_profiles. Today only
-- 'emoji' is wired in the UI.
-- =====================================================================

-- The kind. Everything else keys off this, so a member can set a photo,
-- switch back to an emoji, and switch to the photo again later without
-- losing either.
alter table profiles add column if not exists avatar_kind text not null default 'emoji';
alter table profiles drop constraint if exists avatar_kind_ok;
alter table profiles add constraint avatar_kind_ok
  check (avatar_kind in ('emoji','photo','none'));

-- ⚠️ `avatar` already exists and is documented as "emoji or storage
-- path". Splitting them is deliberate: one column holding two different
-- KINDS of thing is how you end up rendering a file path inside a
-- <span> and shipping a profile that says "avatars/9f3c.jpg" where a
-- face should be. Separate columns can't be confused for each other.
alter table profiles add column if not exists avatar_photo text;

-- A cap, because this is a glyph and not a paragraph. Eight characters
-- is generous for one emoji — a family-of-four with skin tones and
-- zero-width joiners is 11 code units, and we don't want those anyway.
-- Without this, somebody pastes 300 characters into `avatar` and the
-- 60px .pav box detonates on every post they've ever made, on
-- everybody else's screen.
alter table profiles drop constraint if exists avatar_len;
alter table profiles add constraint avatar_len
  check (avatar is null or char_length(avatar) <= 8);

-- Same reasoning, different blast radius. display_name renders inside
-- .pname at 24px Anton on a card that is 4px-bordered and shadowed.
-- 40 characters is a long nickname; 2,000 is an attack on the layout of
-- everyone who reads a thread they posted in.
alter table profiles drop constraint if exists display_name_len;
alter table profiles add constraint display_name_len
  check (display_name is null or char_length(display_name) <= 40);

-- Storage paths only — never a full URL. A URL is a string that decides
-- where a browser goes; a path can only ever be a file in our bucket.
-- Same argument as storing the YouTube video id instead of the link in
-- 0009. Narrow the thing before you trust it.
alter table profiles drop constraint if exists avatar_photo_shape;
alter table profiles add constraint avatar_photo_shape
  check (avatar_photo is null or avatar_photo ~ '^avatars/[A-Za-z0-9._-]{1,80}$');

-- Column grants accumulate. display_name and avatar were already
-- writable from 0002 — which is the irony: the permission to set a name
-- has been there since day one and no screen ever asked for one.
grant update (avatar_kind, avatar_photo) on profiles to authenticated;


-- ---------------------------------------------------------------------
-- Rebuild the window. ⚠️ APPEND ONLY. 18 existing, 1 new, 19 total.
--
-- ONE resolved field goes out, not three. The client should never be
-- handed avatar_kind + avatar + avatar_photo and asked to work out
-- which one wins — that's a decision, and decisions about what a
-- stranger may see belong on this side of the wire. `display_avatar`
-- already exists and already nulls in anonymous mode; this adds
-- `display_avatar_photo` beside it, nulled on exactly the same
-- condition, so an anonymous member has no face by construction rather
-- than by the page remembering to check.
-- ---------------------------------------------------------------------
create or replace view public_profiles with (security_barrier) as
select
  pr.handle,
  lower(pr.handle)                                          as handle_key,
  case when pr.privacy_mode = 'anonymous' then pr.handle
       else coalesce(pr.display_name, pr.handle) end        as display_name,
  case when pr.privacy_mode = 'anonymous' or pr.avatar_kind <> 'emoji'
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
  case when pr.show_lifetime and pr.lifetime_days > 0
       then pr.lifetime_days
            + case when pr.sober_since is null then 0
                   else (current_date - pr.sober_since) end
       else null end                                        as total_days,
  case when pr.privacy_mode = 'anonymous' then null
       else pr.bio end                                      as bio,
  case when pr.privacy_mode = 'anonymous' or not pr.show_location then null
       else nullif(concat_ws(', ', nullif(trim(pr.town), ''),
                                   nullif(trim(pr.state), '')), '')
  end                                                       as location,
  case when pr.privacy_mode = 'anonymous' then null
       else pr.programs end                                 as programs,
  case when pr.privacy_mode = 'anonymous' then null
       else pr.interests end                                as interests,
  (pr.privacy_mode <> 'anonymous'
   and pr.sponsor_status = 'available'
   and pr.sober_since is not null
   and (current_date - pr.sober_since) >= 365)              as sponsor_open,
  -- new in 0012: the photo, on the same anonymity switch as everything
  -- else. Not wired in the UI yet — the column and the gate exist so
  -- that when it is, the privacy decision is already made and tested.
  case when pr.privacy_mode = 'anonymous' or pr.avatar_kind <> 'photo'
       then null else pr.avatar_photo end                   as display_avatar_photo
from profiles pr
where pr.suspended_at is null
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = current_uid() and b.blocked_id = pr.id)
       or (b.blocked_id = current_uid() and b.blocker_id = pr.id)
  );

-- ⚠️ REVOKE FIRST, THEN GRANT. Sixth time.
revoke all on public_profiles from public;
revoke all on public_profiles from anon;
revoke all on public_profiles from authenticated;
grant select on public_profiles to authenticated;


-- =====================================================================
-- READ IT BACK. Expect: pp_cols = 19, new_cols = 2, and the ACL rows
-- EXACTLY postgres/service_role arwdDxtm, authenticated r, nothing else.
-- pg_class, not information_schema — the latter does not reliably show
-- PUBLIC, which is where the Aug 4 and Aug 6 bugs both hid.
-- =====================================================================
select
  (select count(*) from information_schema.columns
     where table_name = 'public_profiles')                          as pp_cols,
  (select count(*) from information_schema.columns
     where table_name = 'profiles'
       and column_name in ('avatar_kind','avatar_photo'))           as new_cols;

select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC') as who,
       split_part(split_part(a, '=', 2), '/', 1)             as privs
from pg_class c, unnest(c.relacl::text[]) a
where c.relname = 'public_profiles';
