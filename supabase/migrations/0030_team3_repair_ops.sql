-- =============================================================================
-- KitaFix - migration 0030
-- Team 3 - Shop & Repair Operations
-- Owner: Team 3 (rule R2: only Team 3 edits this file)
-- =============================================================================
-- WHAT THIS MIGRATION CREATES (Team 3 objects):
--   * public.repair_status enum        - guarded, 0020 may have created it
--   * public.services                  - shop menu + prices (+ RLS)
--   * repairs_staff_* policies         - staff queue: read + update every repair
--   * repairs_technician_select        - technician reads own assigned jobs
--   * public.t3_repairs_status_guard() - STATUS STATE MACHINE (the hard part)
--
-- RULES ENFORCED BY THE DATABASE (the app only makes the buttons nicer):
--   pending     -> in_progress | cancelled
--   in_progress -> testing | cancelled
--   testing     -> completed | in_progress   (in_progress = test failed)
--   completed, cancelled -> nothing (final)
--   pending -> in_progress needs: booking confirmed AND a technician assigned
--   confirm: only a PENDING booking, only ONCE, confirmed_by = the caller
--
-- This file replaces the local stubs. Delete them when this is merged:
--   0002_local_stub_team3_services.sql
--   0090_local_stub_team3_repairs_staff.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared enum (guarded: 0020 may already have created it)
-- -----------------------------------------------------------------------------
do $$
begin
  create type public.repair_status as enum
    ('pending', 'in_progress', 'testing', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

-- -----------------------------------------------------------------------------
-- services: the shop menu (frozen contract: id, name, description, base_price, active)
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists description text;
alter table public.services add column if not exists base_price numeric(10, 2) not null default 0;
alter table public.services add column if not exists active boolean not null default true;
alter table public.services add column if not exists created_at timestamptz not null default now();
alter table public.services add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_name_not_blank'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_name_not_blank check (length(trim(name)) > 0);
  end if;
end
$$;

create or replace function public.t3_services_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists t3_services_touch_updated_at on public.services;
create trigger t3_services_touch_updated_at
  before update on public.services
  for each row execute function public.t3_services_touch_updated_at();

alter table public.services enable row level security;

-- Everyone signed in can read the menu (Team 2 booking form needs it).
drop policy if exists services_read_authenticated on public.services;
create policy services_read_authenticated on public.services
  for select to authenticated
  using (true);

-- Only staff can add / edit / turn off a service.
drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update, delete on public.services to authenticated;

-- -----------------------------------------------------------------------------
-- repairs: staff policies (Team 2 already created the customer policies in 0020)
-- -----------------------------------------------------------------------------
drop policy if exists repairs_staff_select on public.repairs;
create policy repairs_staff_select on public.repairs
  for select to authenticated
  using (public.is_staff());

drop policy if exists repairs_staff_update on public.repairs;
create policy repairs_staff_update on public.repairs
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists repairs_technician_select on public.repairs;
create policy repairs_technician_select on public.repairs
  for select to authenticated
  using (
    exists (
      select 1
      from public.technicians t
      where t.id = repairs.technician_id
        and t.profile_id = auth.uid()
    )
  );

grant select, insert, update on public.repairs to authenticated;

-- -----------------------------------------------------------------------------
-- STATUS STATE MACHINE (before update on repairs)
-- Named t3_* so it fires after Team 2's repairs_guard_customer_update trigger
-- (triggers on the same event fire in alphabetical order).
-- -----------------------------------------------------------------------------
create or replace function public.t3_repairs_status_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 1) CONFIRM: only once, only while pending, and never spoof who confirmed.
  if new.confirmed_at is distinct from old.confirmed_at
     or new.confirmed_by is distinct from old.confirmed_by then
    if old.confirmed_at is not null then
      raise exception 'This booking is already confirmed.'
        using errcode = 'P0001';
    end if;
    if old.status <> 'pending' then
      raise exception 'Only a pending booking can be confirmed.'
        using errcode = 'P0001';
    end if;
    new.confirmed_at := coalesce(new.confirmed_at, now());
    if auth.uid() is not null then
      new.confirmed_by := auth.uid();
    end if;
  end if;

  -- 2) STATUS CHANGE: only the allowed arrows.
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending'        and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('testing', 'cancelled'))
      or (old.status = 'testing'     and new.status in ('completed', 'in_progress'))
    ) then
      raise exception 'Invalid status change: % -> %.', old.status, new.status
        using errcode = 'P0001';
    end if;

    -- Starting the repair needs a confirmed booking and a technician.
    if old.status = 'pending' and new.status = 'in_progress' then
      if new.confirmed_at is null then
        raise exception 'Confirm the booking before starting the repair.'
          using errcode = 'P0001';
      end if;
      if new.technician_id is null then
        raise exception 'Assign a technician before starting the repair.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists t3_repairs_status_guard on public.repairs;
create trigger t3_repairs_status_guard
  before update on public.repairs
  for each row execute function public.t3_repairs_status_guard();

-- -----------------------------------------------------------------------------
-- Ownership comments
-- -----------------------------------------------------------------------------
comment on table public.services is 'Team 3: shop menu and prices. Team 2 reads it for the booking form.';
comment on column public.services.active is 'Team 3: false = hidden from new bookings. Old repairs keep their service.';
comment on function public.t3_repairs_status_guard() is 'Team 3: status state machine + confirm-once rule for public.repairs.';
