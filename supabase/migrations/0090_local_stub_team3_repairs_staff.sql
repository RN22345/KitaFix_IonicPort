-- =============================================================================
-- LOCAL DEV STUB - DO NOT MERGE - OWNED BY TEAM 2 ONLY FOR STANDALONE TESTING
-- =============================================================================
-- Stand-in for the STAFF policies and status trigger that Team 3 writes in
-- 0030_team3_repair_ops.sql (Admin Portal / Repair Queue).
--
-- Runs after 0020 (filename order) because the repairs table must exist.
-- It exists only so the standalone demo can also use the staff side
-- (e.g. change a status in the SQL editor or via the staff app) and so the
-- realtime test (status change -> customer screen updates) is possible.
--
-- Delete this file as soon as the real Team 3 migration is in the repo.
-- =============================================================================

-- Staff may read every repair (queue + dashboard counts).
drop policy if exists repairs_staff_select on public.repairs;
create policy repairs_staff_select on public.repairs
  for select to authenticated
  using (public.is_staff());

-- Staff may update every repair (status, technician, notes, confirm).
drop policy if exists repairs_staff_update on public.repairs;
create policy repairs_staff_update on public.repairs
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Technicians may read repairs assigned to them.
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
