/* =====================================================================
   0167 — THE DAY COUNT, AND THE CLOCK, IN THE MEMBER'S OWN TIME
   9 Oct 2026

   TWO THINGS, ONE CAUSE.

   1. 🔴 THE COUNT HAS BEEN ARRIVING EARLY EVERY EVENING.
      sober_days() is `current_date - p_since`, and current_date on this
      database is UTC. UTC rolls into tomorrow at 8pm Eastern. So from 8pm
      until midnight, every night, every member east of UTC-4 was shown a
      number one higher than the truth.

      Measured on 9 Oct 2026 at 21:21 Eastern, for sober_since 2022-08-03:
          current_date - sober_since                      = 1529
          (now() at time zone 'America/New_York')::date -  = 1528
      Nobody would ever report this. At breakfast it is always right.

   2. The profile now runs a clock under the number, and the clock needs
      to know how far into the member's own day it is. That is what
      secs_into_day is for.

   ⚠️ WHOSE MIDNIGHT. The member's, not the viewer's. A member in
   California looking at a member in Ohio must see the number the Ohio
   member sees on their own page, or the same person has two different day
   counts depending on who is looking.

   ⚠️ 311 of 428 members are America/New_York, 50 are America/Chicago, and
   every single member has a timezone set — so there is no fallback
   population to worry about. The coalesce to 'UTC' below is for a row
   that somehow loses it later, and reproduces exactly today's behaviour
   rather than erroring.

   ---------------------------------------------------------------------
   HOW TO RUN THIS: top to bottom, in one go, in the Supabase SQL editor.
   Section 3 rewrites public_profiles FROM ITS OWN CURRENT DEFINITION by
   string substitution inside the database — the view body is never
   retyped by hand, so it cannot be transcribed wrong. If any anchor is
   missing the script raises and changes nothing.

   🔴 RUN THIS BEFORE DRAGGING THE APP CODE UP. app/u/[handle]/page.jsx
   asks the view for secs_into_day by name, and a Supabase select naming a
   column that does not exist fails the WHOLE query — which would take
   every member profile page down. Database first, then the code.
   ===================================================================== */

begin;

/* ---------------------------------------------------------------------
   1 — whole days, measured from the member's own midnight.

   A NEW NAME rather than a change to sober_days(). sober_days() takes
   only a date, so it cannot know whose day it is, and two views plus
   nine functions reference the old name. Replacing it would mean a
   cascade; adding to it means every caller moves when somebody decides
   it should, one at a time.
   --------------------------------------------------------------------- */
create or replace function public.sober_days_local(p_since date, p_tz text)
returns integer
language sql
stable
security invoker
set search_path = public, pg_catalog
as $fn$
  select case
    when p_since is null then null
    when p_since > (now() at time zone coalesce(nullif(p_tz,''), 'UTC'))::date then null
    else (now() at time zone coalesce(nullif(p_tz,''), 'UTC'))::date - p_since
  end;
$fn$;

/* ---------------------------------------------------------------------
   2 — how far into their current day it is, 0..86399.

   ⚠️ SECONDS, NOT A TIMESTAMP. The browser is deliberately never handed
   an absolute instant: it gets "this far in, as of now" and adds its own
   elapsed time. A phone with a wrong clock still shows the right figure,
   and the member's exact local time never crosses the wire as a date.
   --------------------------------------------------------------------- */
create or replace function public.sober_secs_into_day(p_tz text)
returns integer
language sql
stable
security invoker
set search_path = public, pg_catalog
as $fn$
  select floor(
    extract(epoch from (
      (now() at time zone coalesce(nullif(p_tz,''), 'UTC'))
      - date_trunc('day', now() at time zone coalesce(nullif(p_tz,''), 'UTC'))
    ))
  )::integer;
$fn$;

/* ---------------------------------------------------------------------
   3 — public_profiles, rewritten from itself.

   Three substitutions, each asserted. Nothing is hand-copied.

   ⚠️ secs_into_day is appended LAST. create or replace view can add
   columns only at the end, and the app names its columns one by one
   anyway, so position carries no meaning there.

   ⚠️ It is wrapped in the SAME can_see_day_count() test day_count
   already uses. A member who has set their count to private or to
   connections-only hands out no clock either — the clock implies roughly
   what hour it is where they live, and that is not a new thing to decide
   about, it is the thing they already decided.
   --------------------------------------------------------------------- */
do $do$
declare
  d        text := pg_get_viewdef('public.public_profiles'::regclass, true);
  outer_a  text := E'    sections\n   FROM ( SELECT';
  inner_a  text := E'            pr.sections\n           FROM profiles pr';
  n_days   int;
begin
  n_days := (length(d) - length(replace(d, 'sober_days(pr.sober_since)', '')))
            / length('sober_days(pr.sober_since)');

  if n_days <> 3 then
    raise exception
      'expected sober_days(pr.sober_since) 3 times in public_profiles (day_count, total_days, sponsor_open), found %', n_days;
  end if;
  if position(outer_a in d) = 0 then
    raise exception 'outer column-list anchor not found — view shape changed, stopping';
  end if;
  if position(inner_a in d) = 0 then
    raise exception 'inner subquery anchor not found — view shape changed, stopping';
  end if;

  /* all three: the count, the lifetime total that adds to it, and the
     365-day sponsor threshold. They are the same question. */
  d := replace(d, 'sober_days(pr.sober_since)',
                  'sober_days_local(pr.sober_since, pr.timezone)');

  d := replace(d, inner_a,
       E'            pr.sections,\n'
    || E'                CASE\n'
    || E'                    WHEN NOT can_see_day_count(pr.id, pr.day_count_visibility) THEN NULL::integer\n'
    || E'                    ELSE sober_secs_into_day(pr.timezone)\n'
    || E'                END AS secs_into_day\n'
    || E'           FROM profiles pr');

  d := replace(d, outer_a, E'    sections,\n    secs_into_day\n   FROM ( SELECT');

  execute 'create or replace view public.public_profiles as ' || d;
end
$do$;

/* ---------------------------------------------------------------------
   4 — what gets you through. The other view on sober_days().
   Left alone on purpose: check it, and move it in its own change if it
   needs moving. One view at a time.
   --------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   5 — CHECKS, AND A CONTROL THAT MUST FAIL.

   🔴 Read these before you commit. Every check here has to pass AND the
   control has to fire, or roll back.
   --------------------------------------------------------------------- */
do $do$
declare
  v_secs      int;
  v_local     int;
  v_utc       int;
  v_ctl       int;
  v_col       int;
begin
  -- the column exists and is in range
  select count(*) into v_col
    from information_schema.columns
   where table_schema='public' and table_name='public_profiles'
     and column_name='secs_into_day';
  if v_col <> 1 then raise exception 'secs_into_day did not appear on the view'; end if;

  select sober_secs_into_day('America/New_York') into v_secs;
  if v_secs is null or v_secs < 0 or v_secs > 86399 then
    raise exception 'secs_into_day out of range: %', v_secs;
  end if;

  -- the fix does what it says, on a real row
  select sober_days_local(sober_since, timezone), sober_days(sober_since)
    into v_local, v_utc
    from profiles where handle = 'Tyhowell07';
  raise notice 'Tyhowell07: own timezone = % days, old UTC method = % days', v_local, v_utc;
  if v_local is null then raise exception 'local day count came back null'; end if;

  -- 🔴 THE CONTROL. A zone a long way west must disagree with UTC right
  -- now if this function is reading the zone at all. If these match, the
  -- timezone argument is being ignored and every check above is worthless.
  select sober_days_local('2022-08-03'::date, 'Pacific/Kiritimati') into v_ctl;   -- UTC+14
  if v_ctl = sober_days_local('2022-08-03'::date, 'Pacific/Midway') then          -- UTC-11
    raise exception
      'CONTROL DID NOT FIRE — UTC+14 and UTC-11 returned the same day count, so the zone is being ignored';
  end if;
  raise notice 'control fired: UTC+14 and UTC-11 differ, the zone is being read';
end
$do$;

commit;

/* =====================================================================
   WHAT THIS DOES NOT FIX, AND YOU SHOULD KNOW ABOUT IT.

   Nine other functions measure against sober_since with current_date and
   therefore carry the same evening off-by-one:

     can_host_meetings      delete_my_account    fire_milestone_congrats
     fire_milestone_posts   guard_sober_since    my_friends
     owner_growth           search_members       viewer_has_a_year

   ⚠️ Two of those are worth looking at properly and soon:
   fire_milestone_congrats and fire_milestone_posts decide WHEN somebody
   is congratulated on a milestone. On UTC, a chip post can fire the
   evening before the day it belongs to — somebody gets told they hit a
   year, in front of everybody, on day 364.

   Not touched here because this change is about the profile, and because
   each of those deserves reading on its own rather than a blanket
   find-and-replace across nine functions that decide different things.
   ===================================================================== */
