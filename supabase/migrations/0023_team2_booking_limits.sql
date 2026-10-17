-- =============================================================================
-- KitaFix - migration 0023
-- Team 2 - Booking & Scheduling
-- Owner: Team 2 (rule R2: only Team 2 edits this file)
-- =============================================================================
--
-- 1. FIX: "no past dates" was a CHECK constraint (0020). Postgres re-checks a
--    CHECK on EVERY update of the row, so once a booking's date had passed,
--    nobody could update it any more - not the customer cancelling, and not
--    Team 3 moving it from in_progress to testing or completed. (A CHECK that
--    uses current_date also breaks pg_dump / restore.) It is now a trigger that
--    only looks at the date when a booking is made or moved.
--
-- 2. NEW: anti-spam limit. A customer may have at most 3 active repairs
--    (pending, in_progress or testing) at a time. A 4th booking is rejected
--    with SQLSTATE KF001; the app shows a friendly message and blocks the
--    form before that. Staff (Team 3 portal) and the SQL editor are not limited.
--    The app keeps the same number in MAX_ACTIVE_BOOKINGS (repair.model.ts).
--
-- 3. CLEAN-UP of bookings made before the limit existed:
--    a. pending bookings whose date has already passed (no-shows) -> cancelled
--    b. customers still over the limit: their oldest pending bookings ->
--       cancelled until 3 active remain.
--    in_progress / testing repairs are never touched (that is Team 3's work).
--
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Date rule: trigger instead of CHECK
-- -----------------------------------------------------------------------------
alter table public.repairs drop constraint if exists repairs_booking_date_not_past;

create or replace function public.repairs_booking_date_rule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or new.booking_date is distinct from old.booking_date
     or new.booking_time is distinct from old.booking_time then
    if new.booking_date < current_date then
      -- 23514 = check_violation, so the app keeps showing the same message.
      raise exception 'The booking date cannot be in the past.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists repairs_booking_date_rule on public.repairs;
create trigger repairs_booking_date_rule
  before insert or update on public.repairs
  for each row execute function public.repairs_booking_date_rule();

revoke execute on function public.repairs_booking_date_rule() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. At most 3 active repairs per customer
-- -----------------------------------------------------------------------------
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
  -- SQL editor, migrations, service_role and the staff portal are not limited.
  if auth.uid() is null or public.is_staff() then
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

drop trigger if exists repairs_limit_active_bookings on public.repairs;
create trigger repairs_limit_active_bookings
  before insert on public.repairs
  for each row execute function public.repairs_limit_active_bookings();

revoke execute on function public.repairs_limit_active_bookings() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Clean-up of bookings made before the limit
-- -----------------------------------------------------------------------------
-- a. No-shows: still pending after their day.
update public.repairs
   set status = 'cancelled'
 where status = 'pending'
   and booking_date < current_date;

-- b. Still over the limit: cancel the oldest pending ones first.
with ranked as (
  select r.id,
         r.status,
         row_number() over (
           partition by r.customer_id
           order by (r.status = 'pending'), r.created_at desc
         ) as keep_rank
    from public.repairs r
   where r.status in ('pending', 'in_progress', 'testing')
)
update public.repairs r
   set status = 'cancelled'
  from ranked
 where r.id = ranked.id
   and ranked.status = 'pending'
   and ranked.keep_rank > 3;

comment on column public.repairs.booking_date is
  'Team 2: booking column. Must not be in the past when booked or moved (trigger repairs_booking_date_rule).';
