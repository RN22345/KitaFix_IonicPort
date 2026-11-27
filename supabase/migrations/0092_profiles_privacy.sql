-- =============================================================================
-- 0092_profiles_privacy.sql - personal data in public.profiles (Team 1 table)
-- =============================================================================
-- Problem: 0024's policy profiles_read_authenticated (using true) let every
-- signed-in user read every profile row. Team 1 then added address, birthday,
-- gender, contact_no and account_no to that table, so any customer could read
-- every other user's personal details straight from the API.
--
-- Fix, in two layers:
--   1. Columns. Signed-in users may read only id, full_name, avatar_url, role,
--      active, created_at, updated_at of profiles. Phone, contact_no, address,
--      birthday, gender, account_no and terms_* are not readable through the
--      table at all.
--   2. Rows. A profile is visible only when it is
--        - your own,
--        - you are an admin (accounts screens, reports),
--        - it belongs to shop staff (technician/admin: names in booking, queue),
--        - you are the technician on one of that customer's repairs.
--
-- Your own full row (all columns) comes from the view public.my_profile, which
-- returns exactly one row: the caller's. Admins read other people's details
-- through admin_read_accounts() (0091), which checks for an active admin.
--
-- Every other read in Teams 2-4 asks only for full_name, so it keeps working.
-- If a column is added to profiles later: decide whether it is personal; if it
-- should be readable by others, add it to the grant below, and re-create
-- my_profile so it includes the column.
--
-- Run after 0091. Safe to re-run.
-- =============================================================================
begin;

-- 1) Columns ------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke select, delete, truncate, trigger, references on public.profiles from authenticated;
grant select (id, full_name, avatar_url, role, active, created_at, updated_at)
  on public.profiles to authenticated;
-- UPDATE stays column-limited as set by 0024 + 0097 (no role / active).

-- 2) Rows ---------------------------------------------------------------------
-- Security definer so the policy can look at repairs/technicians without
-- depending on (or recursing into) their own RLS.
create or replace function public.profile_is_my_repair_customer(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.repairs r
    join public.technicians t on t.id = r.technician_id
    where r.customer_id = p_profile
      and t.profile_id = (select auth.uid())
  );
$$;
revoke all on function public.profile_is_my_repair_customer(uuid) from public, anon;
grant execute on function public.profile_is_my_repair_customer(uuid) to authenticated;

drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_read_visible on public.profiles;
create policy profiles_read_visible on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
    or role in ('technician', 'admin')
    or public.profile_is_my_repair_customer(id)
  );

-- 3) Own full profile ----------------------------------------------------------
-- Runs with the view owner's rights (security definer view, on purpose), so it
-- can return the personal columns; the WHERE limits it to the caller's row.
drop view if exists public.my_profile;
create view public.my_profile with (security_barrier = true) as
  select p.*
  from public.profiles p
  where p.id = (select auth.uid());

revoke all on public.my_profile from public, anon, authenticated;
grant select on public.my_profile to authenticated;

commit;
