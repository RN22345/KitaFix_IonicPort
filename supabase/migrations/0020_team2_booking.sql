-- =============================================================================
-- KitaFix - migration 0020
-- Team 2 - Booking & Scheduling
-- Owner: Team 2 (rule R2: only Team 2 edits this file)
-- =============================================================================
--
-- WHAT THIS MIGRATION CREATES (Team 2 objects):
--   * public.repairs                          - booking columns + workflow
--                                               columns (frozen contract)
--   * repairs_no_double_booking               - EXCLUSION constraint: one
--                                               booking per location per hour
--   * RLS policies repairs_*_own              - customers only see/edit own
--   * public.repairs_guard_customer_update()  - customers may only cancel or
--                                               reschedule, never touch
--                                               workflow columns
--   * public.get_taken_slots()                - safe taken-hours lookup for the
--                                               booking form (no customer data)
--   * realtime publication for repairs        - live status on customer screen
--
-- FROZEN CONTRACT READ FROM OTHER TEAMS (do not change here):
--   profiles(id), technicians(id)   Team 1   0010_team1_identity.sql
--   services(id)                    Team 3   0030_team3_repair_ops.sql
--   public.is_staff()               Team 1   RLS helper (rule R5)
--   repair_status enum              Team 3   created guarded below so this file
--                                            also runs in the standalone repo
--
-- "Same hour" is modelled as a 1 hour slot starting at booking_time:
--   booking_slot = [date + time, date + time + 1 hour)
-- Two bookings at the same location whose slots overlap are rejected by the
-- database, even if two requests arrive at the same moment. The app only hides
-- taken hours to be friendly; the database is the source of truth
-- (Module Plan v4 trap: "No availability check").
-- =============================================================================

-- btree_gist lets an EXCLUDE constraint combine text equality (location) with a
-- range overlap test (booking_slot).
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Shared enum (Team 3 owns it; guarded so local stubs / merge order are safe)
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
-- repairs table
-- -----------------------------------------------------------------------------
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),

  -- booking columns (Team 2 writes these)
  customer_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  device_brand text not null,
  device_model text not null,
  location text not null,
  booking_date date not null,
  booking_time time not null,
  issue_screen boolean not null default false,
  issue_battery boolean not null default false,
  issue_charging boolean not null default false,
  issue_camera boolean not null default false,
  issue_audio boolean not null default false,
  issue_software boolean not null default false,

  -- workflow columns (Team 3 owns the values after creation; frozen contract)
  technician_id uuid references public.technicians (id) on delete set null,
  status public.repair_status not null default 'pending',
  staff_notes text,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint repairs_device_brand_not_blank check (length(trim(device_brand)) > 0),
  constraint repairs_device_model_not_blank check (length(trim(device_model)) > 0),
  constraint repairs_location_not_blank check (length(trim(location)) > 0),
  constraint repairs_at_least_one_issue check (
    issue_screen
    or issue_battery
    or issue_charging
    or issue_camera
    or issue_audio
    or issue_software
  ),
  constraint repairs_booking_date_not_past check (booking_date >= current_date)
);

-- Merge-order safety: if the table already existed from another team's file,
-- add the missing columns instead of failing.
alter table public.repairs add column if not exists technician_id uuid references public.technicians (id) on delete set null;
alter table public.repairs add column if not exists status public.repair_status not null default 'pending';
alter table public.repairs add column if not exists staff_notes text;
alter table public.repairs add column if not exists confirmed_by uuid references public.profiles (id) on delete set null;
alter table public.repairs add column if not exists confirmed_at timestamptz;
alter table public.repairs add column if not exists created_at timestamptz not null default now();
alter table public.repairs add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- Availability: the hour slot and the exclusion constraint
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'repairs'
      and column_name = 'booking_slot'
  ) then
    alter table public.repairs
      add column booking_slot tsrange
      generated always as (
        tsrange(
          booking_date + booking_time,
          booking_date + booking_time + interval '1 hour',
          '[)'
        )
      ) stored;
  end if;
end
$$;

-- Same location + overlapping hour + not cancelled = rejected.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repairs_no_double_booking'
      and conrelid = 'public.repairs'::regclass
  ) then
    alter table public.repairs
      add constraint repairs_no_double_booking
      exclude using gist (location with =, booking_slot with &&)
      where (status <> 'cancelled');
  end if;
end
$$;

create index if not exists repairs_customer_idx on public.repairs (customer_id, booking_date desc);
create index if not exists repairs_location_date_idx on public.repairs (location, booking_date);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.t2_repairs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists t2_repairs_touch_updated_at on public.repairs;
create trigger t2_repairs_touch_updated_at
  before update on public.repairs
  for each row execute function public.t2_repairs_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Customer write guard (required rule: cancel a completed repair must fail)
--
-- Team 3's status machine decides which STATUS changes are legal. This trigger
-- only decides which changes a CUSTOMER may send:
--   allowed: cancel (pending/in_progress), reschedule (pending only)
--   blocked: everything else, including any workflow column
-- Staff/admin (Team 3 portal) and SQL editor / service_role are untouched.
-- -----------------------------------------------------------------------------
create or replace function public.repairs_guard_customer_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- SQL editor, migrations and service_role have no customer session.
  if auth.uid() is null then
    return new;
  end if;

  -- Team 3 staff portal may change workflow columns.
  if public.is_staff() then
    return new;
  end if;

  -- From here on: the caller is a signed-in customer.
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

drop trigger if exists repairs_guard_customer_update on public.repairs;
create trigger repairs_guard_customer_update
  before update on public.repairs
  for each row execute function public.repairs_guard_customer_update();

-- -----------------------------------------------------------------------------
-- RLS: Team 2 customer policies (Team 3 adds staff policies in 0030)
-- -----------------------------------------------------------------------------
alter table public.repairs enable row level security;

drop policy if exists repairs_select_own on public.repairs;
create policy repairs_select_own on public.repairs
  for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists repairs_insert_own on public.repairs;
create policy repairs_insert_own on public.repairs
  for insert to authenticated
  with check (customer_id = auth.uid());

drop policy if exists repairs_update_own on public.repairs;
create policy repairs_update_own on public.repairs
  for update to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

grant select, insert, update on public.repairs to authenticated;

-- -----------------------------------------------------------------------------
-- Taken hours for the booking form.
--
-- security definer on purpose: RLS hides other customers' rows from the caller,
-- but the form still needs to know which hours are busy. This function returns
-- ONLY time values - never customer data.
-- -----------------------------------------------------------------------------
create or replace function public.get_taken_slots(
  p_location text,
  p_date date,
  p_exclude_repair uuid default null
)
returns table (booking_time time)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.booking_time
  from public.repairs r
  where r.location = p_location
    and r.booking_date = p_date
    and r.status <> 'cancelled'
    and (p_exclude_repair is null or r.id <> p_exclude_repair)
  order by r.booking_time;
$$;

revoke all on function public.get_taken_slots(text, date, uuid) from public;
grant execute on function public.get_taken_slots(text, date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: pushes status changes (Team 3) to the customer screen (Team 2).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'repairs'
     ) then
    alter publication supabase_realtime add table public.repairs;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Ownership comments (handy when other teams inspect the schema)
-- -----------------------------------------------------------------------------
comment on table public.repairs is
  'KitaFix repair bookings. Team 2 owns booking columns and availability; Team 3 owns workflow columns (status, technician, notes, confirmed_*).';
comment on column public.repairs.customer_id is 'Team 2: booking column, the customer who made the booking.';
comment on column public.repairs.location is 'Team 2: booking column, shop branch. Availability is per location + hour.';
comment on column public.repairs.booking_date is 'Team 2: booking column, no past dates allowed.';
comment on column public.repairs.booking_time is 'Team 2: booking column, start of the 1 hour slot.';
comment on column public.repairs.booking_slot is 'Team 2: generated 1 hour tsrange used by repairs_no_double_booking.';
comment on column public.repairs.status is 'Team 3: workflow column. Frozen repair_status enum only.';
comment on column public.repairs.technician_id is 'Team 3: workflow column after creation; customer may request one at insert time.';
comment on column public.repairs.staff_notes is 'Team 3: workflow column, repair notes.';
comment on column public.repairs.confirmed_by is 'Team 3: workflow column, staff member who confirmed the booking.';
comment on column public.repairs.confirmed_at is 'Team 3: workflow column, when the booking was confirmed.';
