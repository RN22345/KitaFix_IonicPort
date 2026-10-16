-- =============================================================================
-- Team 2 - database rule check (Availability_Test_Plan.md A1-A5, B1-B9, B11)
--
-- Paste the whole file into the Supabase SQL editor and run it. It books,
-- cancels and reschedules as the demo customer (customer@kitafix.test), then
-- ends with RAISE EXCEPTION so EVERYTHING IS ROLLED BACK: the shared data is
-- left untouched. The results are in the error text ("ROLLBACK_RESULTS ...").
-- Copy the PASS/FAIL lines into section D of the test plan.
--
-- B10 (two parallel sessions) cannot run in one script; A3 exercises the same
-- exclusion constraint. Requires migrations 0020-0022 and the demo seed.
-- =============================================================================

create or replace function pg_temp.kf_as(uid uuid) returns void language plpgsql as $f$
begin
  if uid is null then
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $f$;

create or replace function pg_temp.kf_try(label text, stmt text, expect text) returns text language plpgsql as $f$
declare got text := 'ok'; msg text := ''; n bigint;
begin
  begin
    execute stmt;
    get diagnostics n = row_count;
    if stmt ilike 'update%' and n = 0 then got := '0 rows'; end if;
  exception when others then
    got := sqlstate; msg := sqlerrm;
  end;
  return case when got = expect then 'PASS ' else 'FAIL ' end || label
    || ' (expected ' || expect || ', got ' || got || coalesce(nullif(' : ' || msg, ' : '), '') || ')';
end $f$;

do $t$
declare
  cust uuid := (select id from auth.users where email = 'customer@kitafix.test');
  -- "customer B": any signed-in user that is not staff and has no assignments
  other uuid := gen_random_uuid();
  tech uuid := (select id from auth.users where email = 'marcos.tech@kitafix.test');
  svc  uuid := (select id from public.services order by name limit 1);
  d date := current_date + 40;
  r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid(); r3 uuid := gen_random_uuid();
  r4 uuid := gen_random_uuid(); r5 uuid := gen_random_uuid(); r6 uuid := gen_random_uuid();
  r7 uuid := gen_random_uuid(); r8 uuid := gen_random_uuid();
  out text[] := '{}';
  ins text := 'insert into public.repairs (id, customer_id, service_id, device_brand, device_model, location, booking_date, booking_time, issue_battery, issue_description) values (%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)';
  main text := 'Main Branch - Downtown';
  north text := 'North Mall Branch';
  taken text;
begin
  if cust is null or tech is null or svc is null then
    raise exception 'Demo accounts or services missing: run seed_demo_data.sql first.';
  end if;

  -- A. Required tests
  perform pg_temp.kf_as(cust);
  out := out || pg_temp.kf_try('A1 empty brand blocked', format(ins, gen_random_uuid(), cust, svc, '', 'A54', main, d, '09:00', true, null), '23514');
  out := out || pg_temp.kf_try('A1 no issue + no note blocked', format(ins, gen_random_uuid(), cust, svc, 'Samsung', 'A54', main, d, '09:00', false, null), '23514');
  out := out || pg_temp.kf_try('A2 past date blocked', format(ins, gen_random_uuid(), cust, svc, 'Samsung', 'A54', main, current_date - 1, '09:00', true, null), '23514');
  out := out || pg_temp.kf_try('A3 first booking', format(ins, r1, cust, svc, 'Samsung', 'A54', main, d, '10:00', true, null), 'ok');
  out := out || pg_temp.kf_try('A3 same slot again fails', format(ins, gen_random_uuid(), cust, svc, 'Apple', 'iPhone 13', main, d, '10:00', true, null), '23P01');
  out := out || pg_temp.kf_try('A4 same time, other branch', format(ins, r2, cust, svc, 'Apple', 'iPhone 13', north, d, '10:00', true, null), 'ok');
  out := out || pg_temp.kf_try('Note-only booking (0021) still accepted', format(ins, r8, cust, svc, 'Xiaomi', '13T', north, d, '09:00', false, 'screen flickers'), 'ok');

  perform pg_temp.kf_as(null);
  update public.repairs set status = 'completed' where id = r1;
  perform pg_temp.kf_as(cust);
  out := out || pg_temp.kf_try('A5 cancel completed blocked', format('update public.repairs set status = %L where id = %L', 'cancelled', r1), '42501');

  -- B. Rule tests
  out := out || pg_temp.kf_try('B1 book 11:00', format(ins, r3, cust, svc, 'Oppo', 'A78', main, d, '11:00', true, null), 'ok');
  select string_agg(left(booking_time::text, 5), ',' order by booking_time) into taken from public.get_taken_slots(main, d);
  out := out || ('INFO B9 taken hours (expect 10:00,11:00): ' || coalesce(taken, '-'));
  out := out || pg_temp.kf_try('B1 cancel pending', format('update public.repairs set status = %L where id = %L', 'cancelled', r3), 'ok');
  select string_agg(left(booking_time::text, 5), ',' order by booking_time) into taken from public.get_taken_slots(main, d);
  out := out || ('INFO B1 taken after cancel (expect 10:00): ' || coalesce(taken, '-'));
  out := out || pg_temp.kf_try('B8 rebook cancelled slot', format(ins, gen_random_uuid(), cust, svc, 'Oppo', 'A78', main, d, '11:00', true, null), 'ok');

  out := out || pg_temp.kf_try('setup 13:00', format(ins, r4, cust, svc, 'Vivo', 'Y36', main, d, '13:00', true, null), 'ok');
  out := out || pg_temp.kf_try('setup 14:00', format(ins, r5, cust, svc, 'Realme', 'C55', main, d, '14:00', true, null), 'ok');
  out := out || pg_temp.kf_try('setup 15:00', format(ins, r6, cust, svc, 'Nokia', 'G21', main, d, '15:00', true, null), 'ok');
  out := out || pg_temp.kf_try('setup 16:00', format(ins, r7, cust, svc, 'Huawei', 'P30', main, d, '16:00', true, null), 'ok');
  perform pg_temp.kf_as(null);
  update public.repairs set status = 'in_progress' where id = r6;
  update public.repairs set status = 'testing' where id = r7;
  perform pg_temp.kf_as(cust);
  out := out || pg_temp.kf_try('B2 cancel in_progress allowed', format('update public.repairs set status = %L where id = %L', 'cancelled', r6), 'ok');
  out := out || pg_temp.kf_try('B3 cancel testing blocked', format('update public.repairs set status = %L where id = %L', 'cancelled', r7), '42501');

  out := out || pg_temp.kf_try('B4 reschedule to free 17:00', format('update public.repairs set booking_time = %L where id = %L', '17:00', r4), 'ok');
  out := out || pg_temp.kf_try('B5 reschedule onto taken 14:00 fails', format('update public.repairs set booking_time = %L where id = %L', '14:00', r4), '23P01');

  out := out || pg_temp.kf_try('B6 customer sets status completed', format('update public.repairs set status = %L where id = %L', 'completed', r5), '42501');
  out := out || pg_temp.kf_try('B6 customer sets technician', format('update public.repairs set technician_id = (select id from public.technicians limit 1) where id = %L', r5), '42501');
  out := out || pg_temp.kf_try('B7 customer edits device', format('update public.repairs set device_brand = %L where id = %L', 'Other', r5), '42501');
  out := out || pg_temp.kf_try('B7 customer edits issues', format('update public.repairs set issue_screen = true where id = %L', r5), '42501');

  -- B11 + anon
  perform pg_temp.kf_as(other);
  out := out || ('INFO B11 customer rows seen by another customer (expect 0): ' || (select count(*) from public.repairs where customer_id = cust));
  -- Team 3 stub policy repairs_technician_select: a technician sees only jobs assigned to them
  perform pg_temp.kf_as(tech);
  out := out || ('INFO technician sees only assigned jobs (expect 0 unassigned): '
    || (select count(*) from public.repairs r
        where not exists (select 1 from public.technicians t where t.id = r.technician_id and t.profile_id = tech)));
  perform pg_temp.kf_as(cust);
  out := out || ('INFO B11 rows seen by the customer: ' || (select count(*) from public.repairs where customer_id = cust));
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  out := out || ('INFO anon rows visible (expect 0): ' || (select count(*) from public.repairs));
  out := out || pg_temp.kf_try('0022 anon cannot call get_taken_slots', format('select public.get_taken_slots(%L, %L)', main, d), '42501');
  perform pg_temp.kf_as(null);

  raise exception E'ROLLBACK_RESULTS (nothing was saved)\n%', array_to_string(out, E'\n');
end $t$;
