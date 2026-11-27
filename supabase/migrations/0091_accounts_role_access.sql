-- Manual migration: reuse profiles.role; do not reset profiles or enum values.
-- Apply after the identity migration, using Supabase SQL Editor as postgres.
begin;

-- Also supports the minimal test table containing only id and active.
-- Reuse the existing enum if present; otherwise use constrained text values.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    if to_regtype('public.user_role') is not null then
      alter table public.profiles add column role public.user_role not null default 'customer';
    else
      alter table public.profiles add column role text not null default 'customer'
        constraint profiles_account_role_check check (role in ('customer', 'technician', 'admin'));
    end if;
  end if;
end;
$$;

-- RLS row ownership alone does not protect privileged columns.
-- SECURITY INVOKER is intentional: authenticated callers remain restricted,
-- even when an existing RLS policy allows updating the whole own profile row.
create or replace function public.protect_profile_account_access()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if TG_OP = 'INSERT' then
      if new.role::text is distinct from 'customer' or new.active is distinct from true then
        raise exception 'Only trusted administrators may assign account access' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role or new.active is distinct from old.active then
      raise exception 'Only trusted administrators may change account access' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_account_access on public.profiles;
create trigger protect_profile_account_access
before insert or update on public.profiles
for each row execute function public.protect_profile_account_access();

-- Required for a minimal test profiles table. Existing policies remain intact.
alter table public.profiles enable row level security;
drop policy if exists profiles_read_own_account_access on public.profiles;
create policy profiles_read_own_account_access on public.profiles
  for select to authenticated using (id = auth.uid());
grant select on public.profiles to authenticated;
commit;
