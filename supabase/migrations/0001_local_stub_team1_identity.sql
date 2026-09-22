-- =============================================================================
-- LOCAL DEV STUB - DO NOT MERGE - OWNED BY TEAM 2 ONLY FOR STANDALONE TESTING
-- =============================================================================
-- Stand-in for Team 1's real migration (0010_team1_identity.sql) so Team 2 can
-- run the complete booking flow alone on a local Supabase.
--
-- Delete this file as soon as the real Team 1 migration is in the repo.
-- It mirrors the frozen contract Team 2 depends on (Module Plan v4, section 12):
--   profiles(id, full_name, phone, role, active)   -> name + role for displays
--   user_role enum                                 -> customer/technician/staff/admin
--   technicians(id, profile_id, skills, active)    -> booking form picker
--   is_staff(), my_role(), current_user_no()       -> Team 1 RLS helpers
-- =============================================================================

do $$
begin
  create type public.user_role as enum ('customer', 'technician', 'staff', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Unnamed user',
  phone text,
  role public.user_role not null default 'customer',
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;

-- Auto-create a profile on signup (simplified version of Team 1's trigger).
create or replace function public.t1_stub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists t1_stub_on_auth_user_created on auth.users;
create trigger t1_stub_on_auth_user_created
  after insert on auth.users
  for each row execute function public.t1_stub_handle_new_user();

-- Team 1 RLS helper functions (Team 2 calls these, never edits them).
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'customer'::public.user_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role in ('staff', 'admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.current_user_no()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

grant execute on function public.my_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.current_user_no() to authenticated;

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  skills text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.technicians enable row level security;

drop policy if exists technicians_read_authenticated on public.technicians;
create policy technicians_read_authenticated on public.technicians
  for select to authenticated
  using (true);

drop policy if exists technicians_staff_write on public.technicians;
create policy technicians_staff_write on public.technicians
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update, delete on public.technicians to authenticated;
