-- =============================================================================
-- KitaFix - migration 0021
-- Team 2 - Booking & Scheduling
-- Owner: Team 2 (rule R2: only Team 2 edits this file)
-- =============================================================================
--
-- WHY: the New Booking form replaced the six "What is wrong?" checkboxes with
-- one free-text description. This migration (additive, safe to re-run):
--   1. adds public.repairs.issue_description (nullable text, max 500 chars)
--   2. relaxes repairs_at_least_one_issue so a booking needs EITHER at least
--      one issue flag (old clients, old rows) OR a non-blank description
--   3. makes the customer update guard treat issue_description as a booking
--      column customers cannot edit afterwards (same as the six flags)
--
-- Existing rows and other teams' queries are unaffected: the new column is
-- nullable, and every row that passed the old constraint passes the new one.
-- 0020 is NOT edited (it is already applied on the shared project).
-- =============================================================================

-- 1. Column + length limit
alter table public.repairs add column if not exists issue_description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repairs_issue_description_length'
      and conrelid = 'public.repairs'::regclass
  ) then
    alter table public.repairs
      add constraint repairs_issue_description_length
      check (issue_description is null or length(issue_description) <= 500);
  end if;
end
$$;

-- 2. "At least one issue" now also accepts a written description
alter table public.repairs drop constraint if exists repairs_at_least_one_issue;
alter table public.repairs
  add constraint repairs_at_least_one_issue check (
    issue_screen
    or issue_battery
    or issue_charging
    or issue_camera
    or issue_audio
    or issue_software
    or length(trim(coalesce(issue_description, ''))) > 0
  );

-- 3. Customer write guard: identical to 0020 plus issue_description
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

comment on column public.repairs.issue_description is
  'Team 2: booking column, the customer''s own words for "what is wrong" (max 500 chars). Replaces the six issue_* checkboxes for new bookings; the flags stay for older rows.';
