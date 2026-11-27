-- MERGE NOTE (2026-11-27): ported to the 0024 role model during the group merge.
-- public.is_staff() -> (select public.is_admin()); *_staff_* policies -> *_admin_*.
-- Logic is unchanged. Stub 0090 is removed (its policies live here now);
-- stub 0002 stays because 0020's repairs.service_id FK needs services first.
-- =============================================================================
-- KitaFix - migration 0032
-- Team 3 - Shop & Repair Operations: SERVICE HISTORY LOG + FSD gap fixes
-- Owner: Team 3 (rule R2). Run AFTER 0030 and 0031.
-- =============================================================================
-- WHAT THIS MIGRATION ADDS
--   1) public.repair_service_logs  - append-only log of what a technician did on
--      a repair: WHERE (location), WHEN (performed_at) and DETAILS.
--   2) repair_ops_history.remarks  - the "Remarks (if applicable)" column of the
--      status timeline (FSD 3.13), filled through t3_update_repair_status().
--   3) Technician access (FSD 3.11 / 3.13 "SA / TECH"): an assigned technician
--      may read the history of, and add notes to, their own repairs.
--   4) public.repair_status_events - read-only feed of status changes for the
--      reporting module (FSD scope: "sending repair status changes to the
--      appropriate reporting module").
--
-- RULES ENFORCED BY THE DATABASE
--   * A service log can only be written while the repair is IN PROGRESS or
--     TESTING, and only for the technician currently assigned to it.
--   * Staff may log on behalf of the assigned technician; a technician may only
--     log for themselves (logged_by = auth.uid()).
--   * performed_at cannot be in the future (5 minute clock tolerance).
--   * Logs are append-only: no update, no delete.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Remarks on the operational history (status timeline)
-- -----------------------------------------------------------------------------
alter table public.repair_ops_history
  add column if not exists remarks text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'repair_ops_history_remarks_valid'
      and conrelid = 'public.repair_ops_history'::regclass
  ) then
    alter table public.repair_ops_history
      add constraint repair_ops_history_remarks_valid
      check (remarks is null or (length(trim(remarks)) > 0 and length(remarks) <= 1000));
  end if;
end
$$;

-- Re-create the history trigger so status events carry the remarks that
-- t3_update_repair_status() parks in a transaction-local setting.
create or replace function public.t3_repairs_record_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remarks text := nullif(trim(coalesce(current_setting('kitafix.history_remarks', true), '')), '');
begin
  if new.status is distinct from old.status then
    insert into public.repair_ops_history (
      repair_id, event_type, previous_status, new_status, remarks, changed_by
    ) values (
      new.id, 'status', old.status, new.status, v_remarks, auth.uid()
    );
  end if;

  if new.technician_id is distinct from old.technician_id then
    insert into public.repair_ops_history (
      repair_id, event_type, previous_technician_id, new_technician_id, changed_by
    ) values (
      new.id, 'technician', old.technician_id, new.technician_id, auth.uid()
    );
  end if;

  if new.booking_date is distinct from old.booking_date
     or new.booking_time is distinct from old.booking_time then
    insert into public.repair_ops_history (
      repair_id, event_type,
      previous_booking_date, previous_booking_time,
      new_booking_date, new_booking_time, changed_by
    ) values (
      new.id, 'schedule',
      old.booking_date, old.booking_time,
      new.booking_date, new.booking_time, auth.uid()
    );
  end if;
  return new;
end
$$;

-- Status change + optional remarks in ONE transaction (SECURITY INVOKER: the
-- caller's RLS and the 0030 status guard still apply, nothing is bypassed).
create or replace function public.t3_update_repair_status(
  p_repair_id uuid,
  p_status public.repair_status,
  p_remarks text default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_remarks is not null and length(trim(p_remarks)) > 1000 then
    raise exception 'Remarks must be 1,000 characters or fewer.'
      using errcode = 'P0001';
  end if;

  perform set_config('kitafix.history_remarks', coalesce(trim(p_remarks), ''), true);

  update public.repairs
  set status = p_status
  where id = p_repair_id;

  if not found then
    raise exception 'That repair was not found, or you cannot change it.'
      using errcode = '42501';
  end if;

  perform set_config('kitafix.history_remarks', '', true);
end
$$;

revoke all on function public.t3_update_repair_status(uuid, public.repair_status, text)
  from public, anon;
grant execute on function public.t3_update_repair_status(uuid, public.repair_status, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Technician access to history + notes on THEIR repairs (FSD 3.11, 3.13)
-- -----------------------------------------------------------------------------
create or replace function public.t3_is_assigned_technician(p_repair_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.repairs r
    join public.technicians t on t.id = r.technician_id
    where r.id = p_repair_id
      and t.profile_id = auth.uid()
  );
$$;

revoke all on function public.t3_is_assigned_technician(uuid) from public, anon;
grant execute on function public.t3_is_assigned_technician(uuid) to authenticated;

-- The 0031 trigger also mirrors every note into repairs.staff_notes. Team 2's
-- guard trigger (repairs_guard_customer_update) rejects ANY change to that
-- column from a signed-in non-staff user, so a technician's note would fail.
-- Technician notes therefore live in repair_ops_history only (the source of
-- truth the screens read); staff notes are still mirrored as before.
create or replace function public.t3_repair_ops_history_sync_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'note'
     and new.changed_by is not null
     and (auth.uid() is null or (select public.is_admin())) then
    update public.repairs
    set staff_notes = concat_ws(E'\n\n', nullif(trim(staff_notes), ''), new.note)
    where id = new.repair_id;
  end if;
  return new;
end
$$;

drop policy if exists repair_ops_history_technician_read on public.repair_ops_history;
create policy repair_ops_history_technician_read on public.repair_ops_history
  for select to authenticated
  using (public.t3_is_assigned_technician(repair_id));

drop policy if exists repair_ops_history_technician_note on public.repair_ops_history;
create policy repair_ops_history_technician_note on public.repair_ops_history
  for insert to authenticated
  with check (
    event_type = 'note'
    and changed_by = auth.uid()
    and note is not null
    and length(trim(note)) > 0
    and length(note) <= 5000
    and public.t3_is_assigned_technician(repair_id)
  );

-- -----------------------------------------------------------------------------
-- 3) SERVICE HISTORY LOG: where / when / details of technician actions
-- -----------------------------------------------------------------------------
create table if not exists public.repair_service_logs (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null,
  technician_id uuid not null,
  action_type text not null,
  location text not null,
  performed_at timestamptz not null default now(),
  details text not null,
  logged_by uuid,
  created_at timestamptz not null default now(),
  constraint repair_service_logs_repair_id_fkey
    foreign key (repair_id) references public.repairs (id) on delete cascade,
  constraint repair_service_logs_technician_id_fkey
    foreign key (technician_id) references public.technicians (id) on delete restrict,
  constraint repair_service_logs_logged_by_fkey
    foreign key (logged_by) references public.profiles (id) on delete set null,
  constraint repair_service_logs_action_type_check
    check (action_type in ('inspection', 'diagnosis', 'repair', 'testing', 'other')),
  constraint repair_service_logs_location_valid
    check (length(trim(location)) > 0 and length(location) <= 200),
  constraint repair_service_logs_details_valid
    check (length(trim(details)) > 0 and length(details) <= 5000)
);

create index if not exists repair_service_logs_repair_performed_idx
  on public.repair_service_logs (repair_id, performed_at desc);
create index if not exists repair_service_logs_technician_idx
  on public.repair_service_logs (technician_id, performed_at desc);

-- Fills location from the booking when blank and checks the timestamp.
create or replace function public.t3_service_logs_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location text;
  v_created timestamptz;
begin
  select r.location, r.created_at into v_location, v_created
  from public.repairs r
  where r.id = new.repair_id;

  if not found then
    raise exception 'That repair was not found.' using errcode = '23503';
  end if;

  if new.location is null or length(trim(new.location)) = 0 then
    new.location := v_location;
  end if;
  new.location := trim(new.location);
  new.details := trim(new.details);

  if new.performed_at is null then
    new.performed_at := now();
  end if;
  if new.performed_at > now() + interval '5 minutes' then
    raise exception 'The date and time of the action cannot be in the future.'
      using errcode = 'P0001';
  end if;
  if new.performed_at < v_created then
    raise exception 'The action cannot be dated before the repair was booked.'
      using errcode = 'P0001';
  end if;

  if new.logged_by is null then
    new.logged_by := auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists t3_service_logs_before_insert on public.repair_service_logs;
create trigger t3_service_logs_before_insert
  before insert on public.repair_service_logs
  for each row execute function public.t3_service_logs_before_insert();

-- Who may write a log: the repair must be in_progress/testing and the log must
-- name the technician assigned to it; the caller is staff or that technician.
create or replace function public.t3_can_log_service(p_repair_id uuid, p_technician_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.repairs r
    where r.id = p_repair_id
      and r.status in ('in_progress', 'testing')
      and r.technician_id = p_technician_id
      and (
        (select public.is_admin())
        or exists (
          select 1 from public.technicians t
          where t.id = p_technician_id and t.profile_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.t3_can_log_service(uuid, uuid) from public, anon;
grant execute on function public.t3_can_log_service(uuid, uuid) to authenticated;

alter table public.repair_service_logs enable row level security;

drop policy if exists repair_service_logs_read on public.repair_service_logs;
create policy repair_service_logs_read on public.repair_service_logs
  for select to authenticated
  using (
    (select public.is_admin())
    or public.t3_is_assigned_technician(repair_id)
    or exists (
      select 1 from public.technicians t
      where t.id = repair_service_logs.technician_id and t.profile_id = auth.uid()
    )
  );

drop policy if exists repair_service_logs_insert on public.repair_service_logs;
create policy repair_service_logs_insert on public.repair_service_logs
  for insert to authenticated
  with check (
    (logged_by is null or logged_by = auth.uid())
    and public.t3_can_log_service(repair_id, technician_id)
  );

-- Append-only: no UPDATE and no DELETE for anyone using the API.
revoke all on public.repair_service_logs from anon, public, authenticated;
grant select, insert on public.repair_service_logs to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Status-change feed for the reporting module (read only, RLS applies)
-- -----------------------------------------------------------------------------
create or replace view public.repair_status_events
with (security_invoker = true) as
select
  h.id,
  h.repair_id,
  h.previous_status,
  h.new_status,
  h.remarks,
  h.changed_by,
  h.changed_at
from public.repair_ops_history h
where h.event_type = 'status';

revoke all on public.repair_status_events from anon, public;
grant select on public.repair_status_events to authenticated;

-- -----------------------------------------------------------------------------
-- Ownership comments
-- -----------------------------------------------------------------------------
comment on table public.repair_service_logs is
  'Team 3: append-only service history. Where (location), when (performed_at) and details of what a technician did on a repair.';
comment on column public.repair_service_logs.location is
  'Team 3: where the action was performed (branch / bench). Defaults to the booking location.';
comment on column public.repair_service_logs.performed_at is
  'Team 3: when the action was performed (may be earlier than created_at, never in the future).';
comment on column public.repair_ops_history.remarks is
  'Team 3: optional remark entered with a status change (status timeline, FSD 3.13).';
comment on view public.repair_status_events is
  'Team 3: read-only status-change feed for the reporting module (Team 4).';
