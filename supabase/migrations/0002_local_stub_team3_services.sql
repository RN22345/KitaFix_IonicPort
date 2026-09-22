-- =============================================================================
-- LOCAL DEV STUB - DO NOT MERGE - OWNED BY TEAM 2 ONLY FOR STANDALONE TESTING
-- =============================================================================
-- Stand-in for Team 3's real migration (0030_team3_repair_ops.sql) for the
-- services table, so the booking form has a menu + prices to read.
--
-- Delete this file as soon as the real Team 3 migration is in the repo.
-- Team 2 only READS this table (Module Plan v4, section 12).
-- =============================================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;

drop policy if exists services_read_authenticated on public.services;
create policy services_read_authenticated on public.services
  for select to authenticated
  using (true);

drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update, delete on public.services to authenticated;
