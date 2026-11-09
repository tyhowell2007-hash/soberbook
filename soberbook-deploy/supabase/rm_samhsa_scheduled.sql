-- =====================================================================
-- RecoveryMap: run the monthly SAMHSA check from Supabase itself.
-- 9 Nov 2026 (Kenny). Needs rm_samhsa_monthly.sql (already applied).
--
-- Every morning at 07:23 UTC, Supabase's scheduler (pg_cron) runs
-- rm_samhsa_run(3): up to 3 states whose last check is 28+ days old.
-- For each state it reads SAMHSA's directory over the internet (the
-- `http` extension), turns each facility into a RecoveryMap listing,
-- and hands them to rm_samhsa_apply (match, add, hide after 2 misses,
-- log). Each state is its own step: if SAMHSA fails for one state,
-- that state is logged as an error and retried the next day, and the
-- other states still run.
--
-- Nothing here is reachable from the website or the app. There are no
-- keys and no public URLs.
--
-- Test without changing anything:  select rm_samhsa_run(1, true);
-- See what ran:                    select * from rm_samhsa_runs order by ran_at desc;
-- See what changed:                select * from rm_samhsa_log order by at desc;
-- Pause the schedule:              select cron.unschedule('rm-samhsa-monthly-check');
-- =====================================================================

create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

begin;

-- ---------------------------------------------------------------------
-- Same as rm_samhsa_monthly.sql, plus one line: the scratch tables are
-- cleared first, so several states can run in one transaction.
-- ---------------------------------------------------------------------
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

  update centers t set samhsa_key = m.key, samhsa_last_seen = v_today,
         samhsa_checked = v_today, samhsa_misses = 0
  from (select distinct on (center_id) center_id, key from pairs
        order by center_id, same_key desc nulls last) m
  where t.id = m.center_id;
  get diagnostics v_matched = row_count;

  with u as (
    update centers t set hidden = false, hidden_reason = null
    where t.state = p_state and t.hidden and t.hidden_reason like 'samhsa:%'
      and t.id in (select center_id from pairs)
    returning t.id)
  insert into rm_samhsa_log (state, center_id, action, detail)
  select p_state, id, 'unhidden', 'Listed in SAMHSA again' from u;
  get diagnostics v_unhidden = row_count;

  update centers t set samhsa_misses = samhsa_misses + 1, samhsa_checked = v_today
  where t.state = p_state and t.samhsa_key is not null
    and t.id not in (select center_id from pairs)
    and t.samhsa_checked is distinct from v_today;

  with h as (
    update centers t set hidden = true,
           hidden_reason = 'samhsa: not in SAMHSA''s directory for 2 monthly checks'
    where t.state = p_state and not t.hidden and t.samhsa_misses >= 2
    returning t.id)
  insert into rm_samhsa_log (state, center_id, action, detail)
  select p_state, id, 'hidden', 'Not in SAMHSA for 2 monthly checks' from h;
  get diagnostics v_hidden = row_count;

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

-- ---------------------------------------------------------------------
-- The ID SAMHSA facilities get here (same as the 6 and 9 Nov imports):
-- djb2 hash of "name1|street1|zip", lowercase, 8 hex digits.
-- ---------------------------------------------------------------------
create or replace function public.rm_djb2(p text)
returns text language plpgsql immutable as $$
declare x bigint := 5381; ch text;
begin
  foreach ch in array regexp_split_to_array(coalesce(p, ''), '') loop
    x := (x * 33 + ascii(ch)) % 4294967296;
  end loop;
  return lpad(to_hex(x), 8, '0');
end;
$$;

-- "(614) 555-0100 x12" -> "614-555-0100 x12"
create or replace function public.rm_phone_fmt(p text)
returns text language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then null
    when m is null then btrim(p)
    else m[1] || '-' || m[2] || '-' || m[3]
         || coalesce(' x' || substring(m[4] from '\d+'), '')
  end
  from (select regexp_match(p, '^\D*(\d{3})\D*(\d{3})\D*(\d{4})(.*)$') m) x;
$$;

-- ---------------------------------------------------------------------
-- One SAMHSA facility -> one RecoveryMap listing (same codes as the rest
-- of the table; lib/rm/words.js turns them into plain words).
-- ---------------------------------------------------------------------
create or replace function public.rm_samhsa_map(r jsonb)
returns jsonb language plpgsql immutable as $$
declare
  cat jsonb; tc text; st text; pay text; pa text; age text; spg text; lca text; tap text; lang text; excl text;
  otp boolean; name text; street text; svc text[]; lv text[]; sp text[]; cert text[]; ins text[]; lg text[];
  tag text[]; ph text; adm text; lat float8; lng float8;
  corr text := 'correction|jail|prison|detention|sheriff|penitentiary|inmate|incarcerat|\mMCI\M|house of correction|forensic';
begin
  select coalesce(jsonb_object_agg(btrim(e->>'f1'), coalesce(e->>'f3', '')), '{}'::jsonb) into cat
    from jsonb_array_elements(case when jsonb_typeof(r->'services') = 'array' then r->'services' else '[]'::jsonb end) e;
  tc := coalesce(cat->>'Type of Care', ''); st := coalesce(cat->>'Service Setting', '');
  pay := coalesce(cat->>'Payment/Insurance/Funding Accepted', ''); pa := coalesce(cat->>'Payment Assistance Available', '');
  age := coalesce(cat->>'Age Groups Accepted', ''); spg := coalesce(cat->>'Special Programs/Groups Offered', '');
  lca := coalesce(cat->>'License/Certification/Accreditation', ''); tap := coalesce(cat->>'Treatment Approaches', '');
  lang := coalesce(cat->>'Language Services', '') || '; ' || coalesce(cat->>'Other Languages', '');
  excl := coalesce(cat->>'Exclusive Services', '');
  otp := (r->>'typeFacility') = 'OTP';

  svc := array_remove(array[
    case when tc ~ 'Substance use treatment|Detoxification' or r->>'typeFacility' = 'SA' or otp then 'substance_use' end,
    case when tc ~ 'Mental health treatment' or r->>'typeFacility' = 'MH' then 'mental_health' end], null);

  lv := array_remove(array[
    case when (tc || st) ~* 'detox' or cat ? 'Detoxification (medical withdrawal) Services' then 'detox' end,
    case when st ~ 'Residential/24|Short-term residential|Long-term residential|Hospital inpatient' then 'residential' end,
    case when st ~* 'Partial hospitalization|day treatment' then 'php' end,
    case when st ~ 'Intensive outpatient' then 'iop' end,
    case when st ~ 'Outpatient' or otp then 'outpatient' end,
    case when tap ~ 'Individual psychotherapy' then 'individual_therapy' end,
    case when tc ~ 'Transitional housing' then 'sober_living' end,
    case when st ~* 'methadone|buprenorphine|naltrexone' or coalesce(cat->>'Opioid Medications used in Treatment', '') <> '' or otp then 'medication_assisted' end], null);

  sp := array_remove(array[
    case when age ~* 'Young Adults' then 'young_adult' end,
    case when spg ~ 'Adult women' then 'women_only' end,
    case when spg ~ 'Pregnant/postpartum' then 'pregnant_postpartum' end,
    case when spg ~ 'Adult men' then 'men_only' end,
    case when spg ~ 'Veterans' then 'veterans' end,
    case when spg ~ 'experienced trauma' then 'trauma_informed' end,
    case when (tc || spg) ~* 'co-occurring' then 'dual_diagnosis' end,
    case when (age || spg) ~* 'Adolescents' then 'adolescent' end], null);

  cert := array_remove(array[
    case when lca ~* 'Joint Commission' then 'joint_commission' end,
    case when lca ~ '\mState\M' then 'state_licensed' end,
    case when lca ~* 'SAMHSA' then 'samhsa' end,
    case when lca ~* 'Rehabilitation Facilities|CARF' then 'carf' end], null);

  ins := array_remove(array[
    case when pay ~ 'Medicaid' then 'medicaid' end,
    case when pay ~ 'Medicare' then 'medicare' end,
    case when pay ~ 'Cash or self-payment' then 'cash' end,
    case when pay ~ 'SAMHSA funding' then 'samhsa_block_grant' end,
    case when pay ~ 'Federal, or any government funding|Federal Grants' then 'federal_funding' end,
    case when pay ~ 'Private health insurance' then 'private' end,
    case when pay ~ 'TRICARE' then 'tricare' end,
    case when pay ~ 'State-financed|State mental health agency|Other State funds' then 'state' end,
    case when pay ~ 'IHS/Tribal' then 'ihs_tribal' end], null);

  lg := array_remove(array[
    case when lang ~ 'Sign language' then 'sign_language' end,
    case when lang ~ 'Spanish' then 'spanish' end], null);

  tag := array_remove(array[
    case when 'substance_use' = any(svc) then 'Substance use care' end,
    case when 'mental_health' = any(svc) then 'Mental health care' end,
    case when 'detox' = any(lv) then 'Detox' end,
    case when 'residential' = any(lv) then 'Residential' end,
    case when 'php' = any(lv) then 'Day program' end,
    case when 'iop' = any(lv) then 'Intensive outpatient' end,
    case when 'outpatient' = any(lv) then 'Outpatient care' end,
    case when 'medication_assisted' = any(lv) then 'Medication-assisted treatment' end,
    case when 'sober_living' = any(lv) then 'Sober living' end,
    case when 'veterans' = any(sp) then 'Veterans program' end], null);

  name := concat_ws(' — ', nullif(r->>'name1', ''), nullif(r->>'name2', ''));
  street := concat_ws(', ', nullif(r->>'street1', ''), nullif(r->>'street2', ''));
  if street !~ '\d' then street := ''; end if;   -- SAMHSA sometimes puts program codes here
  ph := rm_phone_fmt(r->>'phone'); adm := rm_phone_fmt(r->>'intake1');
  lat := case when r->>'latitude' ~ '^-?\d+(\.\d+)?$' then (r->>'latitude')::float8 end;
  lng := case when r->>'longitude' ~ '^-?\d+(\.\d+)?$' then (r->>'longitude')::float8 end;

  return jsonb_build_object(
    'key', rm_djb2(lower(coalesce(r->>'name1', '') || '|' || coalesce(r->>'street1', '') || '|' || coalesce(r->>'zip', ''))),
    'name', name,
    'slug_base', btrim(regexp_replace(replace(lower(name || ' ' || coalesce(r->>'city', '') || ' ' || coalesce(r->>'state', '')), '&', ' and '), '[^a-z0-9]+', '-', 'g'), '-'),
    'tagline', nullif(array_to_string(tag[1:5], ' • '), ''),
    'address_line1', nullif(street, ''),
    'city', r->>'city',
    'zip', nullif(left(coalesce(r->>'zip', ''), 5), ''),
    'has_address', street <> '',
    'latitude', lat, 'longitude', lng,
    'phone', ph,
    'admissions_phone', case when adm is distinct from ph then adm end,
    'levels_of_care', to_jsonb(lv), 'services', to_jsonb(svc), 'specialties', to_jsonb(sp),
    'certifications', to_jsonb(cert), 'insurance_accepted', to_jsonb(ins), 'languages', to_jsonb(lg),
    'accepts_insurance', case when ins && array['medicaid','medicare','private','tricare','state'] then true when pay <> '' then false end,
    'accepts_medicaid', case when pay <> '' then pay ~ 'Medicaid' end,
    'accepts_medicare', case when pay <> '' then pay ~ 'Medicare' end,
    'sliding_scale', case when pa <> '' or pay <> '' then pa ~ 'Sliding fee' end,
    'excluded', (name ~* corr) or (street ~* corr) or (excl ~ 'DUI/DWI'));
end;
$$;

-- ---------------------------------------------------------------------
-- Every SAMHSA facility in one state, mapped. Covers the state's area
-- with a grid of 400 km circles. Raises an error if any request fails:
-- a half-read state must never be applied.
-- ---------------------------------------------------------------------
create or replace function public.rm_samhsa_fetch(p_state text, p_min_lat float8, p_max_lat float8, p_min_lng float8, p_max_lng float8)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  la float8; lo float8; step_lo float8; pg int; pages int; resp record; j jsonb; e jsonb;
  m jsonb; tries int; result jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '30');
  drop table if exists pg_temp.rm_fetch;
  create temp table rm_fetch (key text primary key, doc jsonb) on commit drop;
  la := p_min_lat - 1;
  while la <= p_max_lat + 1 + 2.25 loop
    step_lo := 4.5 / greatest(cos(radians(least(la, p_max_lat + 1))), 0.3);
    lo := p_min_lng - 1;
    while lo <= p_max_lng + 1 + step_lo / 2 loop
      pg := 1; pages := 1;
      loop
        tries := 0;
        loop
          tries := tries + 1;
          select * into resp from extensions.http_get(format(
            'https://findtreatment.gov/locator/exportsAsJson/v2?sAddr=%s,%s&limitType=2&limitValue=400000&pageSize=500&page=%s&sort=0',
            round(least(la, p_max_lat + 1)::numeric, 3), round(least(lo, p_max_lng + 1)::numeric, 3), pg));
          exit when resp.status = 200;
          if tries >= 3 then raise exception 'SAMHSA answered HTTP % for %', resp.status, p_state; end if;
          perform pg_sleep(2);
        end loop;
        j := resp.content::jsonb;
        pages := coalesce((j->>'totalPages')::int, 1);
        for e in select * from jsonb_array_elements(case when jsonb_typeof(j->'rows') = 'array' then j->'rows' else '[]'::jsonb end) loop
          if e->>'state' = p_state then
            m := rm_samhsa_map(e);
            insert into rm_fetch values (m->>'key', m) on conflict (key) do nothing;
          end if;
        end loop;
        pg := pg + 1;
        exit when pg > pages;
        perform pg_sleep(0.25);
      end loop;
      lo := lo + step_lo;
    end loop;
    la := la + 4.5;
  end loop;
  select coalesce(jsonb_agg(f.doc), '[]'::jsonb) into result from rm_fetch f;
  drop table if exists pg_temp.rm_fetch;
  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- The daily run: up to p_max states that are due. p_dry = true reads
-- SAMHSA and reports counts, changing nothing.
-- ---------------------------------------------------------------------
create or replace function public.rm_samhsa_run(p_max int default 3, p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; rows jsonb; res jsonb := '[]'::jsonb; one jsonb;
begin
  for b in select * from rm_samhsa_due(28, p_max) loop
    begin
      rows := rm_samhsa_fetch(b.state, b.min_lat, b.max_lat, b.min_lng, b.max_lng);
      if p_dry then
        one := jsonb_build_object('state', b.state, 'dry', true,
          'facilities', jsonb_array_length(rows),
          'excluded', (select count(*) from jsonb_array_elements(rows) x where (x->>'excluded')::boolean));
      else
        one := rm_samhsa_apply(b.state, rows);
      end if;
    exception when others then
      one := jsonb_build_object('state', b.state, 'error', left(sqlerrm, 300));
      if not p_dry then
        insert into rm_samhsa_runs (state, error) values (b.state, 'Could not read SAMHSA: ' || left(sqlerrm, 300));
      end if;
    end;
    res := res || jsonb_build_array(one);
  end loop;
  return jsonb_build_object('checked', jsonb_array_length(res), 'dry', p_dry, 'results', res);
end;
$$;

revoke all on function public.rm_samhsa_fetch(text, float8, float8, float8, float8) from public, anon, authenticated;
revoke all on function public.rm_samhsa_run(int, boolean) from public, anon, authenticated;
revoke all on function public.rm_samhsa_apply(text, jsonb) from public, anon, authenticated;

commit;

-- Daily at 07:23 UTC (2:23 am Eastern). Re-running this file updates the
-- same schedule rather than adding a second one.
select cron.schedule('rm-samhsa-monthly-check', '23 7 * * *', $cron$select public.rm_samhsa_run(3)$cron$);
