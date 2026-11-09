-- =====================================================================
-- RecoveryMap: monthly SAMHSA check and cleanup. 6 Nov 2026 (Kenny).
--
-- What it does, once a month per state (run by /api/rm/samhsa, daily,
-- a few states at a time):
--   * Matches every listing to SAMHSA's current directory
--     (same SAMHSA id, or same phone + ZIP, or same street + ZIP).
--   * Adds SAMHSA facilities that aren't listed yet (not correctional,
--     not DUI-only, not a duplicate of an existing listing).
--   * Hides a listing that SAMHSA used to list but has dropped for two
--     monthly checks in a row. Hidden = left out of search, not deleted.
--     A hidden listing that reappears in SAMHSA is shown again.
--   * Listings SAMHSA never listed (private programs) are never touched.
--   * Every add / hide / unhide is written to rm_samhsa_log.
--   * Safety stop: if SAMHSA returns far fewer facilities than last time
--     (under 60%), nothing is changed for that state that month.
--
-- Undo a hide:  update centers set hidden = false, hidden_reason = null where id = '...';
-- See changes:  select * from rm_samhsa_log order by at desc;
-- See runs:     select * from rm_samhsa_runs order by ran_at desc;
-- =====================================================================

begin;

alter table public.centers
  add column if not exists hidden boolean not null default false,
  add column if not exists hidden_reason text,
  add column if not exists samhsa_key text,
  add column if not exists samhsa_last_seen date,
  add column if not exists samhsa_checked date,
  add column if not exists samhsa_misses int not null default 0;
create index if not exists centers_state_idx on public.centers (state);
create index if not exists centers_samhsa_key_idx on public.centers (samhsa_key);
create index if not exists centers_slug_idx on public.centers (slug);

create table if not exists public.rm_samhsa_runs (
  id bigserial primary key,
  state text not null,
  ran_at timestamptz not null default now(),
  facilities int, matched int, added int, hidden int, unhidden int,
  error text
);
create table if not exists public.rm_samhsa_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  state text, center_id text, action text, detail text
);
alter table public.rm_samhsa_runs enable row level security;
alter table public.rm_samhsa_log enable row level security;
-- No policies on purpose: only the scheduled job (service role) and the
-- dashboard can read or write these two tables.

-- Phone -> 10 digits (or null).
create or replace function public.rm_digits(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^1\d{10}$' then substr(d, 2, 10)
    when length(d) >= 10 then substr(d, 1, 10)
    else null end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x;
$$;

-- Street -> comparable form ("1815 West Market Street" = "1815 W Market St").
create or replace function public.rm_street(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(
      regexp_replace(lower(coalesce(p, '')), '[^a-z0-9 ]+', ' ', 'g'),
    '\mstreet\M', 'st', 'g'), '\mavenue\M', 'ave', 'g'), '\mroad\M', 'rd', 'g'),
    '\mdrive\M', 'dr', 'g'), '\mboulevard\M', 'blvd', 'g'), '\mlane\M', 'ln', 'g'),
    '\mnorth\M', 'n', 'g'), '\msouth\M', 's', 'g'), '\meast\M', 'e', 'g'),
    '\mwest\M', 'w', 'g'), '\msuite\M', 'ste', 'g'), '\mhighway\M', 'hwy', 'g'),
    '\s+', ' ', 'g'));
$$;

-- Which states are due (not checked in p_days), with the area to search.
create or replace function public.rm_samhsa_due(p_days int default 28, p_limit int default 10)
returns table (state text, min_lat float8, max_lat float8, min_lng float8, max_lng float8, last_run timestamptz)
language sql stable security definer set search_path = public as $$
  with box as (
    select c.state,
      percentile_cont(0.01) within group (order by c.latitude)  as min_lat,
      percentile_cont(0.99) within group (order by c.latitude)  as max_lat,
      percentile_cont(0.01) within group (order by c.longitude) as min_lng,
      percentile_cont(0.99) within group (order by c.longitude) as max_lng
    from centers c
    where c.latitude is not null and c.longitude is not null
    group by c.state
  ), last as (
    select r.state, max(r.ran_at) as last_run
    from rm_samhsa_runs r where r.error is null group by r.state
  )
  select b.state, b.min_lat, b.max_lat, b.min_lng, b.max_lng, l.last_run
  from box b left join last l on l.state = b.state
  where l.last_run is null or l.last_run < now() - make_interval(days => p_days)
  order by l.last_run nulls first, b.state
  limit p_limit;
$$;

-- The monthly check for one state. p_rows: SAMHSA facilities in that
-- state, already mapped by the job (lib/rm/samhsa.js).
create or replace function public.rm_samhsa_apply(p_state text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := current_date;
  v_n int; v_prev int;
  v_matched int := 0; v_added int := 0; v_hidden int := 0; v_unhidden int := 0;
  r record; v_slug text; i int;
begin
  v_n := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  select facilities into v_prev from rm_samhsa_runs
    where state = p_state and error is null order by ran_at desc limit 1;
  if v_n = 0 or (v_prev is not null and v_n < v_prev * 0.6) then
    insert into rm_samhsa_runs (state, facilities, error)
      values (p_state, v_n, format('Safety stop: %s facilities from SAMHSA vs %s last time. Nothing changed.', v_n, coalesce(v_prev, 0)));
    return jsonb_build_object('state', p_state, 'stopped', true, 'facilities', v_n, 'previous', v_prev);
  end if;

  -- Safe when several states run in one transaction (e.g. the SQL editor).
  drop table if exists pg_temp.s, pg_temp.c, pg_temp.pairs;
  create temp table s on commit drop as
  select x.*, rm_digits(x.phone) ph1, rm_digits(x.admissions_phone) ph2,
         rm_street(x.address_line1) st, left(coalesce(x.zip, ''), 5) z
  from jsonb_to_recordset(p_rows) as x(
    key text, name text, slug_base text, tagline text, address_line1 text, city text, zip text,
    has_address boolean, latitude float8, longitude float8, phone text, admissions_phone text,
    levels_of_care text[], services text[], specialties text[], certifications text[],
    insurance_accepted text[], languages text[], accepts_insurance boolean,
    accepts_medicaid boolean, accepts_medicare boolean, sliding_scale boolean, excluded boolean);

  create temp table c on commit drop as
  select id, samhsa_key, rm_digits(phone) ph1, rm_digits(admissions_phone) ph2,
         case when address_line1 ~ '\d' then rm_street(address_line1) else '' end st,
         left(coalesce(zip, ''), 5) z
  from centers where state = p_state;

  create temp table pairs on commit drop as
  select c.id center_id, s.key, (c.samhsa_key = s.key) same_key
  from c join s on (
       c.samhsa_key = s.key
    or (c.z <> '' and c.z = s.z and (
         (c.ph1 is not null and c.ph1 in (s.ph1, s.ph2))
      or (c.ph2 is not null and c.ph2 in (s.ph1, s.ph2))
      or (c.st <> '' and c.st = s.st))));

  -- 1. Listings found in SAMHSA this month
  update centers t set samhsa_key = m.key, samhsa_last_seen = v_today,
         samhsa_checked = v_today, samhsa_misses = 0
  from (select distinct on (center_id) center_id, key from pairs
        order by center_id, same_key desc nulls last) m
  where t.id = m.center_id;
  get diagnostics v_matched = row_count;

  -- 2. Back in SAMHSA after being hidden by this job: show again
  with u as (
    update centers t set hidden = false, hidden_reason = null
    where t.state = p_state and t.hidden and t.hidden_reason like 'samhsa:%'
      and t.id in (select center_id from pairs)
    returning t.id)
  insert into rm_samhsa_log (state, center_id, action, detail)
  select p_state, id, 'unhidden', 'Listed in SAMHSA again' from u;
  get diagnostics v_unhidden = row_count;

  -- 3. Used to be in SAMHSA, not this month: count a miss (once per day)
  update centers t set samhsa_misses = samhsa_misses + 1, samhsa_checked = v_today
  where t.state = p_state and t.samhsa_key is not null
    and t.id not in (select center_id from pairs)
    and t.samhsa_checked is distinct from v_today;

  -- 4. Two monthly misses in a row: hide (not delete)
  with h as (
    update centers t set hidden = true,
           hidden_reason = 'samhsa: not in SAMHSA''s directory for 2 monthly checks'
    where t.state = p_state and not t.hidden and t.samhsa_misses >= 2
    returning t.id)
  insert into rm_samhsa_log (state, center_id, action, detail)
  select p_state, id, 'hidden', 'Not in SAMHSA for 2 monthly checks' from h;
  get diagnostics v_hidden = row_count;

  -- 5. New in SAMHSA and not already listed: add
  for r in
    select * from s
    where not coalesce(s.excluded, false)
      and s.key not in (select key from pairs)
      and not exists (select 1 from centers x where x.id = 'samhsa-' || s.key)
  loop
    v_slug := r.slug_base; i := 2;
    while exists (select 1 from centers where slug = v_slug) loop
      v_slug := r.slug_base || '-' || i; i := i + 1;
    end loop;
    insert into centers (id, slug, name, tagline, address_line1, city, state, zip, has_address,
      latitude, longitude, phone, admissions_phone, levels_of_care, services, specialties,
      certifications, insurance_accepted, languages, accepts_insurance, accepts_medicaid,
      accepts_medicare, sliding_scale, source, snapshot_on, samhsa_key, samhsa_last_seen, samhsa_checked)
    values ('samhsa-' || r.key, v_slug, r.name, r.tagline, r.address_line1, r.city, p_state, r.zip,
      coalesce(r.has_address, false), r.latitude, r.longitude, r.phone, r.admissions_phone,
      coalesce(r.levels_of_care, '{}'), coalesce(r.services, '{}'), coalesce(r.specialties, '{}'),
      coalesce(r.certifications, '{}'), coalesce(r.insurance_accepted, '{}'), coalesce(r.languages, '{}'),
      r.accepts_insurance, r.accepts_medicaid, r.accepts_medicare, r.sliding_scale,
      'samhsa', v_today, r.key, v_today, v_today);
    insert into rm_samhsa_log (state, center_id, action, detail)
      values (p_state, 'samhsa-' || r.key, 'added', r.name);
    v_added := v_added + 1;
  end loop;

  insert into rm_samhsa_runs (state, facilities, matched, added, hidden, unhidden)
    values (p_state, v_n, v_matched, v_added, v_hidden, v_unhidden);
  return jsonb_build_object('state', p_state, 'facilities', v_n, 'matched', v_matched,
    'added', v_added, 'hidden', v_hidden, 'unhidden', v_unhidden);
end;
$$;

revoke all on function public.rm_samhsa_due(int, int) from public, anon, authenticated;
revoke all on function public.rm_samhsa_apply(text, jsonb) from public, anon, authenticated;
grant execute on function public.rm_samhsa_due(int, int) to service_role;
grant execute on function public.rm_samhsa_apply(text, jsonb) to service_role;

-- Search leaves hidden listings out. Each of these functions reads
-- "from centers c" exactly once; it now reads only listings not hidden.
do $$
declare f text; d text; n int;
begin
  foreach f in array array['rm_search','rm_facets','center_states','center_cities','search_centers','rm_phone_list'] loop
    select pg_get_functiondef(p.oid) into d
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = f;
    if d is null then raise exception 'function % not found', f; end if;
    if position('(select * from centers where not hidden) c' in d) > 0 then continue; end if;
    n := (length(d) - length(replace(d, 'from centers c', ''))) / length('from centers c');
    if n <> 1 then raise exception '% has % matches, expected 1', f, n; end if;
    execute replace(d, 'from centers c', 'from (select * from centers where not hidden) c');
  end loop;
end $$;

commit;
