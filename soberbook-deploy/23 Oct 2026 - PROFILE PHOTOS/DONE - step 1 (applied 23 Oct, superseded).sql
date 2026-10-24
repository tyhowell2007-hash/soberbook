-- ===================================================================
-- PROFILE PHOTOS · STEP 1 OF 1 STILL OUTSTANDING
--
-- The code is ALREADY on GitHub (commit 88c9959, 23 Oct).
-- This has NOT run yet. Until it does, the app is looking for a
-- column that does not exist.
--
-- WHERE:  https://supabase.com/dashboard/project/sggizsfqbnqjerubcfly/sql/new
--         Check the project ref in that URL reads  sggizsfqbnqjerubcfly
-- HOW:    select all of this file, paste, press Run.
--         Then run "STEP 2 - check step 1 worked.sql".
-- ===================================================================

-- 1 · the column -------------------------------------------------------
alter table public.profiles
  add column if not exists gallery text[] not null default '{}'::text[];

-- 2 · the cap and the shape, IN THE DATABASE ---------------------------
-- The editor disables its button at ten because a disabled button is
-- kinder than a refusal. This is what enforces it: a limit that lives
-- only in a React component is a limit anybody with a browser console
-- does not have. The prefix test matters just as much -- a row holding
-- 'posts/<uuid>' would send the signer to ask the wrong view about
-- somebody else's file.
alter table public.profiles drop constraint if exists profiles_gallery_sane;
alter table public.profiles add constraint profiles_gallery_sane check (
  gallery is not null
  and cardinality(gallery) <= 10
  and not exists (
    select 1 from unnest(gallery) g
     where g is null or g = '' or g !~ '^gallery/[A-Za-z0-9._-]+$'
  )
);

-- 3 · grants -- BOTH, and that is the whole point ----------------------
-- 2 Sept: UPDATE was granted on a profiles column and SELECT was not.
-- The grant was real and unusable, /me went down for every member, and
-- it was disguised as a missing account for hours. A column members may
-- write is a column members must be able to read back.
grant select (gallery), update (gallery) on public.profiles to authenticated;

-- 4 · the sweeper's map of what is alive -------------------------------
-- This teaches referenced_media() that profile photos are live files.
-- It MUST be in before the sweeper is told about the new bucket, or the
-- sweeper reports every member's album as an orphan and offers to
-- delete it. That is 0063's lesson and it is why this sits here.
create or replace function public.referenced_media()
 returns table(path text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select unnest(photo_urls) from posts where photo_urls is not null
  union
  select photo_url    from posts    where photo_url    is not null
  union
  select video_url    from posts    where video_url    is not null
  union
  select avatar_photo from profiles where avatar_photo is not null
  union
  /* 0190 -- a member's profile album. Every entry, not just the first. */
  select unnest(gallery) from profiles where coalesce(cardinality(gallery),0) > 0
  union
  select media_path   from drops    where media_path   is not null
  union
  select art_path     from drops    where art_path     is not null
  union
  select thumb_path   from content_items where thumb_path is not null
  union
  select unnest(photo_urls) from room_messages where photo_urls is not null
  union
  select unnest(photo_urls) from messages where photo_urls is not null
  union
  select unnest(photo_urls) from comments      where photo_urls is not null
  union
  select video_url          from room_messages where video_url  is not null
  union
  select video_url          from messages      where video_url  is not null
  union
  /* ADDED 18 Sept, before the story buckets exist. Live only. */
  select photo_url from stories
   where photo_url is not null and deleted_at is null and expires_at > now()
  union
  select video_url from stories
   where video_url is not null and deleted_at is null and expires_at > now()
$function$;

-- 5 · the view ---------------------------------------------------------
-- REBUILT FROM THE LIVE DEFINITION RATHER THAN RETYPED. public_profiles
-- is a hundred lines of privacy rules and every one is load-bearing;
-- hand-copying it to add one column is how a CASE goes missing and an
-- anonymous member's bio quietly becomes public. Both insertion points
-- are asserted, so if the view is not the shape this expects it RAISES
-- instead of half-applying.
do $do$
declare
  d      text := pg_get_viewdef('public.public_profiles'::regclass, true);
  outer_anchor constant text := E'    secs_into_day\n   FROM ( SELECT pr.handle,';
  inner_anchor constant text := E'END AS secs_into_day\n           FROM profiles pr';
  d2     text;
begin
  if position(outer_anchor in d) = 0 then
    raise exception '0190: outer anchor not found -- the view has changed shape';
  end if;
  if position(inner_anchor in d) = 0 then
    raise exception '0190: inner anchor not found -- the view has changed shape';
  end if;

  d2 := replace(d, outer_anchor,
        E'    secs_into_day,\n    gallery\n   FROM ( SELECT pr.handle,');

  -- AN EMPTY ARRAY FOR AN ANONYMOUS MEMBER, exactly as
  -- display_avatar_photo is null for one. The album comes off every
  -- other member's screen the same moment the face, the name and the
  -- bio do -- and comes back if they switch open again, because nothing
  -- is deleted. Their own /me signs these off their own row instead, so
  -- they can still see what they have got.
  d2 := replace(d2, inner_anchor,
        E'END AS secs_into_day,\n'
     || E'                CASE\n'
     || E'                    WHEN pr.privacy_mode = ''anonymous''::text THEN ''{}''::text[]\n'
     || E'                    ELSE COALESCE(pr.gallery, ''{}''::text[])\n'
     || E'                END AS gallery\n'
     || E'           FROM profiles pr');

  if d2 = d then
    raise exception '0190: nothing was replaced';
  end if;

  execute 'create or replace view public.public_profiles as ' || d2;
end
$do$;

-- 6 · the bucket -------------------------------------------------------
-- Private, like every bucket a member's own pictures land in. webp only,
-- because finalize writes webp and nothing else -- an allow-list that
-- accepts more than the code produces is a door nobody needed open.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;
