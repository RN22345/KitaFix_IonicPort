-- MANUAL: review and run as postgres in Supabase SQL Editor. Not deployed by the app.
begin;

-- Serialize consolidation with signups and concurrent trigger/schema changes.
-- This briefly blocks writes to auth.users until COMMIT (or rollback).
lock table auth.users in share row exclusive mode;

-- Do not guess what other teams' Auth triggers do. Abort without changing them.
do $$
declare
  legacy record;
  expected_function text;
  -- REQUIRED when either test trigger exists: inspect the complete live function
  -- using pg_get_functiondef, review its side effects, then paste its returned MD5.
  -- Leave this marker unchanged if no legacy test trigger exists (e.g. rerun).
  reviewed_test_function_md5 constant text := '6be4e7526b092b7640e9b6ffcb321c5d';
begin
  if exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
    and not tgisinternal and (tgtype & 4) <> 0
    and tgname not in ('create_test_profile', 'create_test_profile_after_signup',
      't1_stub_on_auth_user_created', 'accounts_on_signup')) then
    raise exception 'Unknown Auth INSERT trigger: inspect pg_get_triggerdef and consolidate profile creation before applying';
  end if;

  -- Names alone are insufficient: validate each trigger before dropping it.
  for legacy in select * from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
      and tgname in ('create_test_profile', 'create_test_profile_after_signup',
        't1_stub_on_auth_user_created', 'accounts_on_signup')
  loop
    expected_function := case legacy.tgname
      when 't1_stub_on_auth_user_created' then 'public.t1_stub_handle_new_user()'
      when 'accounts_on_signup' then 'public.accounts_create_signup_profile()'
      else 'public.create_test_profile()' end;
    if legacy.tgtype <> 5 -- exactly AFTER INSERT FOR EACH ROW
      or legacy.tgnargs <> 0 or legacy.tgqual is not null
      or legacy.tgfoid is distinct from to_regprocedure(expected_function)::oid
      or not exists (select 1 from pg_proc where oid = legacy.tgfoid
        and prorettype = 'pg_catalog.trigger'::regtype and pronargs = 0) then
      raise exception 'Unexpected definition for Auth trigger %; inspect before consolidation', legacy.tgname;
    end if;
    if legacy.tgname in ('create_test_profile', 'create_test_profile_after_signup')
      and md5(pg_get_functiondef(legacy.tgfoid)) is distinct from reviewed_test_function_md5 then
      raise exception 'Review public.create_test_profile() and set reviewed_test_function_md5 before applying';
    end if;
  end loop;
end $$;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists full_name text,
  add column if not exists contact_no text,
  add column if not exists birthday date,
  add column if not exists gender text,
  add column if not exists created_at timestamptz default now();
alter table public.profiles alter column role set default 'customer';
alter table public.profiles alter column active set default true;

create or replace function public.accounts_create_signup_profile()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  details jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Explicit allowlist: never copy metadata role, active, password or arbitrary fields.
  insert into public.profiles (id, role, active, first_name, last_name, full_name,
    contact_no, birthday, gender)
  values (new.id, 'customer', true,
    details->>'first_name', details->>'last_name',
    coalesce(details->>'full_name', split_part(new.email, '@', 1), 'Unnamed user'),
    details->>'contact_no', nullif(details->>'birthday', '')::date, details->>'gender')
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.accounts_create_signup_profile() from public, anon, authenticated;

drop trigger if exists create_test_profile on auth.users;
drop trigger if exists create_test_profile_after_signup on auth.users;
drop trigger if exists t1_stub_on_auth_user_created on auth.users;
drop trigger if exists accounts_on_signup on auth.users;
create trigger accounts_on_signup after insert on auth.users
  for each row execute function public.accounts_create_signup_profile();

-- Under the lock, prove consolidation before committing any schema changes.
do $$ begin
  if (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass
      and not tgisinternal and (tgtype & 4) <> 0) <> 1
    or not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
      and tgname = 'accounts_on_signup' and tgtype = 5 and tgenabled = 'O'
      and tgfoid = 'public.accounts_create_signup_profile()'::regprocedure) then
    raise exception 'Auth profile trigger consolidation failed; rolling back';
  end if;
end $$;

-- Guards privileged columns even where an existing own-row UPDATE policy is broad.
create or replace function public.protect_profile_account_access()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if TG_OP = 'INSERT' then
      if new.id is distinct from auth.uid() or new.role::text is distinct from 'customer'
        or new.active is distinct from true then
        raise exception 'Only trusted server code may assign account access' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role or new.active is distinct from old.active
      or new.id is distinct from old.id then
      raise exception 'Only trusted server code may change account access' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_account_access on public.profiles;
create trigger protect_profile_account_access before insert or update on public.profiles
  for each row execute function public.protect_profile_account_access();

alter table public.profiles enable row level security;
-- Preserve existing policies; add only the own-profile read needed by login.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles'
    and policyname='profiles_read_own_account_access') then
    create policy profiles_read_own_account_access on public.profiles
      for select to authenticated using (id = auth.uid());
  end if;
end $$;
grant select on public.profiles to authenticated;
commit;
