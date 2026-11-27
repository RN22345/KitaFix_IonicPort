-- MERGE NOTE (2026-11-27): ported to the 0024 role model during the group merge.
-- public.is_staff() -> (select public.is_admin()); *_staff_* policies -> *_admin_*.
-- Logic is unchanged. Stub 0090 is removed (its policies live here now);
-- stub 0002 stays because 0020's repairs.service_id FK needs services first.
-- KitaFix Team 3: queue tools, staff history, notes, rescheduling, and service snapshots.

alter table public.repairs
  add column if not exists repair_started_at timestamptz,
  add column if not exists service_name_snapshot text,
  add column if not exists service_price_snapshot numeric(10, 2);

update public.repairs r
set service_name_snapshot = s.name,
    service_price_snapshot = s.base_price
from public.services s
where s.id = r.service_id
  and (r.service_name_snapshot is null or r.service_price_snapshot is null);

create or replace function public.t3_repairs_snapshot_service()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    select s.name, s.base_price
      into new.service_name_snapshot, new.service_price_snapshot
    from public.services s
    where s.id = new.service_id;
    if not found then
      raise exception 'The selected service was not found.'
        using errcode = '23503';
    end if;
  else
    if new.service_id is distinct from old.service_id then
      raise exception 'A service cannot be changed after a repair is booked.'
        using errcode = '42501';
    end if;
    new.service_name_snapshot := old.service_name_snapshot;
    new.service_price_snapshot := old.service_price_snapshot;
  end if;
  return new;
end
$$;

drop trigger if exists t3_repairs_snapshot_service on public.repairs;
create trigger t3_repairs_snapshot_service
  before insert or update on public.repairs
  for each row execute function public.t3_repairs_snapshot_service();

create or replace function public.t3_repairs_capture_started_at()
returns trigger
language plpgsql
as $$
begin
  new.repair_started_at := old.repair_started_at;
  if new.status = 'in_progress'
     and old.status is distinct from new.status
     and new.repair_started_at is null then
    new.repair_started_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists t3_repairs_capture_started_at on public.repairs;
create trigger t3_repairs_capture_started_at
  before update on public.repairs
  for each row execute function public.t3_repairs_capture_started_at();

create or replace function public.t3_repairs_reschedule_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.booking_date is distinct from old.booking_date
      or new.booking_time is distinct from old.booking_time)
     and old.status <> 'pending' then
    raise exception 'Only a pending repair can be rescheduled.'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists t3_repairs_reschedule_guard on public.repairs;
create trigger t3_repairs_reschedule_guard
  before update on public.repairs
  for each row execute function public.t3_repairs_reschedule_guard();

create table if not exists public.repair_ops_history (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs (id) on delete cascade,
  event_type text not null check (event_type in ('status', 'technician', 'schedule', 'note')),
  previous_status public.repair_status,
  new_status public.repair_status,
  previous_technician_id uuid,
  new_technician_id uuid,
  previous_booking_date date,
  previous_booking_time time,
  new_booking_date date,
  new_booking_time time,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint repair_ops_history_note_not_blank
    check (note is null or length(trim(note)) > 0),
  constraint repair_ops_history_note_length
    check (note is null or length(note) <= 5000)
);

create index if not exists repair_ops_history_repair_changed_at_idx
  on public.repair_ops_history (repair_id, changed_at desc);

alter table public.repair_ops_history enable row level security;

drop policy if exists repair_ops_history_admin_read on public.repair_ops_history;
create policy repair_ops_history_admin_read on public.repair_ops_history
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists repair_ops_history_admin_note on public.repair_ops_history;
create policy repair_ops_history_admin_note on public.repair_ops_history
  for insert to authenticated
  with check (
    (select public.is_admin())
    and event_type = 'note'
    and changed_by = auth.uid()
    and note is not null
    and length(trim(note)) > 0
    and length(note) <= 5000
  );

revoke all on public.repair_ops_history from anon, public, authenticated;
grant select, insert on public.repair_ops_history to authenticated;

create or replace function public.t3_repair_ops_history_sync_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'note' and new.changed_by is not null then
    update public.repairs
    set staff_notes = concat_ws(E'\n\n', nullif(trim(staff_notes), ''), new.note)
    where id = new.repair_id;
  end if;
  return new;
end
$$;

drop trigger if exists t3_repair_ops_history_sync_note on public.repair_ops_history;
create trigger t3_repair_ops_history_sync_note
  after insert on public.repair_ops_history
  for each row execute function public.t3_repair_ops_history_sync_note();

create or replace function public.t3_repairs_record_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.repair_ops_history (
      repair_id, event_type, previous_status, new_status, changed_by
    ) values (
      new.id, 'status', old.status, new.status, auth.uid()
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

drop trigger if exists t3_repairs_record_history on public.repairs;
create trigger t3_repairs_record_history
  after update on public.repairs
  for each row execute function public.t3_repairs_record_history();

insert into public.repair_ops_history (repair_id, event_type, note, changed_at)
select r.id, 'note', r.staff_notes, coalesce(r.updated_at, now())
from public.repairs r
where nullif(trim(r.staff_notes), '') is not null
  and not exists (
    select 1
    from public.repair_ops_history h
    where h.repair_id = r.id and h.event_type = 'note' and h.note = r.staff_notes
  );

comment on table public.repair_ops_history is
  'Team 3 append-only operational history: status, technician, schedule changes, and repair notes.';
comment on column public.repairs.repair_started_at is
  'Team 3: first time this repair entered in_progress; used as the actual repair date.';
comment on column public.repairs.service_name_snapshot is
  'Team 3: service name captured at booking time so catalog edits do not rewrite history.';
comment on column public.repairs.service_price_snapshot is
  'Team 3: service price captured at booking time so catalog edits do not rewrite history.';
