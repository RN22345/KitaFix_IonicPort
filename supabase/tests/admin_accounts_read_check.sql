-- Run as postgres in SQL Editor AFTER 0093. Read-only, rolled back.
-- Uses existing accounts only. Missing role fixtures are reported as SKIP.
begin;
do $$
declare
  fixture record;
  caller_id uuid;
  rejected boolean;
  actual_count bigint;
  expected_count bigint;
begin
  for fixture in select * from (values
    ('customer', true), ('technician', true), ('admin', false), ('anonymous', false)
  ) as cases(role_name, active_status)
  loop
    caller_id := null;
    if fixture.role_name <> 'anonymous' then
      select p.id into caller_id from public.profiles p join auth.users u on u.id = p.id
        where p.role::text = fixture.role_name and p.active = fixture.active_status limit 1;
      if caller_id is null then
        raise notice 'SKIP: no existing % active=% fixture', fixture.role_name, fixture.active_status;
        continue;
      end if;
    end if;
    perform set_config('request.jwt.claim.sub', coalesce(caller_id::text, ''), true);
    perform set_config('request.jwt.claims', json_build_object('sub', caller_id)::text, true);
    rejected := false;
    begin
      if caller_id is null then set local role anon;
      else set local role authenticated;
      end if;
      perform * from public.admin_read_accounts(null);
    exception when insufficient_privilege then rejected := true;
    end;
    reset role;
    if not rejected then raise exception 'FAIL: % was allowed', fixture.role_name; end if;
    raise notice 'PASS: % rejected', fixture.role_name;
  end loop;

  select p.id into caller_id from public.profiles p join auth.users u on u.id = p.id
    where p.role::text = 'admin' and p.active is true limit 1;
  if caller_id is null then raise notice 'SKIP: no active Admin fixture'; return; end if;
  select count(*) into expected_count from auth.users;
  perform set_config('request.jwt.claim.sub', caller_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', caller_id)::text, true);
  set local role authenticated;
  select count(*) into actual_count from public.admin_read_accounts(null);
  if actual_count <> expected_count then raise exception 'FAIL: Auth/list count mismatch'; end if;
  select count(*) into actual_count from public.admin_read_accounts(caller_id);
  if actual_count <> 1 then raise exception 'FAIL: UUID detail lookup'; end if;
  reset role;
  raise notice 'PASS: active Admin list/count and UUID detail';
end $$;
rollback;
