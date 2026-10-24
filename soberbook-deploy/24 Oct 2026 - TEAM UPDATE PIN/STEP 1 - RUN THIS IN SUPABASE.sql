-- ===================================================================
-- TEAM UPDATE PIN · the database half
--
-- WHERE: https://supabase.com/dashboard/project/sggizsfqbnqjerubcfly/sql/new
--        Check the project ref in that URL reads sggizsfqbnqjerubcfly
-- HOW:   select all, paste, Run. Then run STEP 2.
--
-- ⚠️ IF IT SHOWS A RED ERROR, SEND ME THE TEXT. The editor runs a pasted
-- script as ONE transaction: one error rolls back everything before it
-- and the screen still looks like it finished. That is exactly what
-- happened on 23 Oct and it cost us an hour.
--
-- ⭐ ORDER DOES NOT MATTER THIS TIME. The code is written so the wall
-- works whether or not this has run -- if the view is missing, the card
-- simply does not appear. Nothing breaks either way. That is the lesson
-- from 23 Oct built into the code instead of into a warning.
-- ===================================================================

create table if not exists public.team_updates (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  created_at timestamptz not null default now(),
  -- Which admin wrote it. Never shown to a member -- the view below does
  -- not return it -- but an account anybody can post as, with no name
  -- attached, is the one that eventually says something nobody will own.
  posted_by  uuid,
  cleared_at timestamptz,
  constraint team_update_body_sane
    check (length(btrim(body)) between 1 and 800)
);

-- Members never touch this table. RLS on with NO policies means the
-- default denial holds even if a grant gets added by accident later.
alter table public.team_updates enable row level security;
revoke all on public.team_updates from anon, authenticated;

-- The only thing a member can read, and it is one row.
-- A view rather than a policy on the table, deliberately: a policy would
-- hand members SELECT on the table itself, which carries every cleared
-- update and the admin id that wrote each one.
create or replace view public.live_team_update as
  select id, body, created_at
    from public.team_updates
   where cleared_at is null
   order by created_at desc
   limit 1;

revoke all on public.live_team_update from anon;
grant select on public.live_team_update to authenticated;

-- ONE PIN AT A TIME, ENFORCED RATHER THAN REMEMBERED. Posting clears the
-- live one in the same statement that writes the new one. Six sponsor
-- posters were once pinned with only two showing, because "only one" was
-- a thing a person had to remember.
create or replace function public.post_team_update(p_body text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $fn$
declare v_id uuid;
begin
  -- The lock, not the 404 on the admin page. Delete that screen and
  -- this still refuses.
  if not is_moderator() then
    raise exception 'not allowed';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'nothing to post';
  end if;

  update public.team_updates set cleared_at = now() where cleared_at is null;

  insert into public.team_updates (body, posted_by)
       values (btrim(p_body), current_uid())
    returning id into v_id;

  return v_id;
end
$fn$;

create or replace function public.clear_team_update()
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not is_moderator() then
    raise exception 'not allowed';
  end if;
  update public.team_updates set cleared_at = now() where cleared_at is null;
  return true;
end
$fn$;

revoke all on function public.post_team_update(text) from public, anon;
revoke all on function public.clear_team_update()   from public, anon;
grant execute on function public.post_team_update(text) to authenticated;
grant execute on function public.clear_team_update()    to authenticated;
