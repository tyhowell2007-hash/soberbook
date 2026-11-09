-- Patch 9 Nov 2026: SAMHSA sometimes sends "services": null. Re-creates two functions; changes no data.
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
