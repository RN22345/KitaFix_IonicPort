-- =============================================================================
-- KitaFix - migration 0024
-- Group change (all four team leaders agreed): "staff" and "admin" are ONE role
-- Written by Team 2; Team 1 (profiles, roles), Team 3 (repair ops) and
-- Team 4 (admin portal) copy the same names into their real migrations (R10).
-- =============================================================================
--
-- 1. ROLES: user_role is now customer | technician | admin.
--    Every 'staff' profile becomes 'admin'. Postgres cannot remove an enum
--    value, so the type is rebuilt and the column converted.
--
-- 2. HELPER: is_staff() is replaced by is_admin(). All policies and Team 2
--    triggers now call is_admin(). Policies are renamed *_admin_* and call it
--    as (select public.is_admin()), so Postgres runs it once per query.
--
-- 3. SECURITY FIX: before this, a signed-in user could change their OWN role
--    (profiles_update_own + a table-wide UPDATE grant), so any customer could
--    make themselves admin. Users may now change only full_name, phone and
--    avatar_url. Role and active changes go through two admin-only functions:
--      set_user_role(target uuid, new_role user_role)
--      set_user_active(target uuid, is_active boolean)
--    An admin cannot change their own role or deactivate themselves, so the
--    shop cannot lose its last admin by accident.
--
-- Not changed: the column repairs.staff_notes keeps its name (Team 3 owns it,
-- and it means "notes by the shop", not a role).
--
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles: rebuild user_role without 'staff'
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
      from pg_enum e
     where e.enumtypid = 'public.user_role'::regtype
       and e.enumlabel = 'staff'
  ) then
    -- my_role() returns the type, so it must go before the type can change.
    drop function if exists public.my_role();

    alter table public.profiles alter column role drop default;
    alter type public.user_role rename to user_role_old;
    create type public.user_role as enum ('customer', 'technician', 'admin');

    alter table public.profiles
      alter column role type public.user_role
      using (case role::text when 'staff' then 'admin' else role::text end)::public.user_role;

    alter table public.profiles alter column role set default 'customer';
    drop type public.user_role_old;
  end if;
end
$$;

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

-- -----------------------------------------------------------------------------
-- 2. Helper: is_admin() replaces is_staff()
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role = 'admin' and p.active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- technicians
drop policy if exists technicians_staff_write on public.technicians;
drop policy if exists technicians_admin_write on public.technicians;
create policy technicians_admin_write on public.technicians
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- services
drop policy if exists services_staff_write on public.services;
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- repairs
drop policy if exists repairs_staff_select on public.repairs;
drop policy if exists repairs_admin_select on public.repairs;
create policy repairs_admin_select on public.repairs
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists repairs_staff_update on public.repairs;
drop policy if exists repairs_admin_update on public.repairs;
create policy repairs_admin_update on public.repairs
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Team 2 triggers: same rules as 0021 / 0023, now asking is_admin().
create or replace function public.repairs_guard_customer_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- The admin portal (Team 3 / Team 4) may change workflow columns.
  if public.is_admin() then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id then
    raise exception 'A booking cannot be moved to another customer.'
      using errcode = '42501';
  end if;

  if new.device_brand is distinct from old.device_brand
     or new.device_model is distinct from old.device_model
     or new.location is distinct from old.location
     or new.service_id is distinct from old.service_id
     or new.technician_id is distinct from old.technician_id
     or new.issue_screen is distinct from old.issue_screen
     or new.issue_battery is distinct from old.issue_battery
     or new.issue_charging is distinct from old.issue_charging
     or new.issue_camera is distinct from old.issue_camera
     or new.issue_audio is distinct from old.issue_audio
     or new.issue_software is distinct from old.issue_software
     or new.issue_description is distinct from old.issue_description
     or new.staff_notes is distinct from old.staff_notes
     or new.confirmed_by is distinct from old.confirmed_by
     or new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'Customers may only change the date, the time, or cancel a booking.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'Customers may only cancel a booking.'
      using errcode = '42501';
  end if;

  if old.status not in ('pending', 'in_progress') then
    raise exception 'This repair can no longer be changed by the customer.'
      using errcode = '42501';
  end if;

  if (new.booking_date is distinct from old.booking_date
      or new.booking_time is distinct from old.booking_time)
     and old.status <> 'pending' then
    raise exception 'Only a pending booking can be rescheduled.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

create or replace function public.repairs_limit_active_bookings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  max_active constant integer := 3;
  active_count integer;
begin
  -- SQL editor, migrations, service_role and the admin portal are not limited.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Two bookings sent at the same moment must not both see "2 active".
  perform pg_advisory_xact_lock(hashtextextended('t2_active_bookings:' || new.customer_id::text, 0));

  select count(*)
    into active_count
    from public.repairs r
   where r.customer_id = new.customer_id
     and r.status in ('pending', 'in_progress', 'testing');

  if active_count >= max_active then
    raise exception 'You already have % active repairs.', active_count
      using errcode = 'KF001',
            hint = 'Wait until one is finished, or cancel one, before booking again.';
  end if;

  return new;
end
$$;

drop function if exists public.is_staff();

-- -----------------------------------------------------------------------------
-- 3. Security: users edit only their own name, phone and avatar
-- -----------------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create or replace function public.set_user_role(target uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change roles.' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;

  update public.profiles set role = new_role, updated_at = now() where id = target;
  if not found then
    raise exception 'No such user.' using errcode = 'P0002';
  end if;

  -- Keep the technicians list in step with the role.
  if new_role = 'technician' then
    insert into public.technicians (profile_id) values (target)
      on conflict (profile_id) do update set active = true, updated_at = now();
  else
    update public.technicians set active = false, updated_at = now()
     where profile_id = target and active;
  end if;
end
$$;

create or replace function public.set_user_active(target uuid, is_active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can turn accounts on or off.' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot turn off your own account.' using errcode = '42501';
  end if;

  update public.profiles set active = is_active, updated_at = now() where id = target;
  if not found then
    raise exception 'No such user.' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
revoke execute on function public.set_user_active(uuid, boolean) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;

comment on function public.is_admin() is 'Team 1 helper: true when the signed-in user is an active admin. Replaces is_staff() (0024).';
comment on function public.set_user_role(uuid, public.user_role) is 'Admin only. Changes another user''s role and keeps public.technicians in step.';
comment on function public.set_user_active(uuid, boolean) is 'Admin only. Turns another user''s account on or off.';
comment on column public.repairs.confirmed_by is 'Team 3: workflow column, admin who confirmed the booking.';
